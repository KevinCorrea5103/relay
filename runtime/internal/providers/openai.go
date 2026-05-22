package providers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"strings"
)

const openaiDefaultURL = "https://api.openai.com/v1"

type OpenAI struct {
	apiKey  string
	baseURL string
	client  *http.Client
}

func NewOpenAI(apiKey, baseURL string) *OpenAI {
	if baseURL == "" {
		baseURL = openaiDefaultURL
	}
	baseURL = strings.TrimRight(baseURL, "/")
	return &OpenAI{apiKey: apiKey, baseURL: baseURL, client: http.DefaultClient}
}

type openaiMessage struct {
	Role       string           `json:"role"`
	Content    *string          `json:"content,omitempty"`
	ToolCalls  []openaiToolCall `json:"tool_calls,omitempty"`
	ToolCallID string           `json:"tool_call_id,omitempty"`
}

type openaiToolCall struct {
	ID       string             `json:"id"`
	Type     string             `json:"type"`
	Function openaiToolCallFunc `json:"function"`
}

type openaiToolCallFunc struct {
	Name      string `json:"name"`
	Arguments string `json:"arguments"`
}

type openaiToolWrap struct {
	Type     string             `json:"type"`
	Function openaiToolFunction `json:"function"`
}

type openaiToolFunction struct {
	Name        string         `json:"name"`
	Description string         `json:"description,omitempty"`
	Parameters  map[string]any `json:"parameters"`
}

func (o *OpenAI) Stream(ctx context.Context, req StreamRequest) (<-chan StreamEvent, error) {
	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 1024
	}

	messages := make([]openaiMessage, 0, len(req.Messages)+1)
	if req.System != "" {
		s := req.System
		messages = append(messages, openaiMessage{Role: "system", Content: &s})
	}
	for _, m := range req.Messages {
		messages = append(messages, convertToOpenAI(m)...)
	}

	payload := map[string]any{
		"model":      req.Model,
		"messages":   messages,
		"max_tokens": maxTokens,
		"stream":     true,
		"stream_options": map[string]any{
			"include_usage": true,
		},
	}
	if len(req.Tools) > 0 {
		tools := make([]openaiToolWrap, len(req.Tools))
		for i, t := range req.Tools {
			tools[i] = openaiToolWrap{
				Type: "function",
				Function: openaiToolFunction{
					Name:        t.Name,
					Description: t.Description,
					Parameters:  t.InputSchema,
				},
			}
		}
		payload["tools"] = tools
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", o.baseURL+"/chat/completions", bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("authorization", "Bearer "+o.apiKey)
	httpReq.Header.Set("content-type", "application/json")
	httpReq.Header.Set("accept", "text/event-stream")

	resp, err := o.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		errBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("openai %d: %s", resp.StatusCode, string(errBody))
	}

	out := make(chan StreamEvent, 16)
	go o.parseStream(resp, out)
	return out, nil
}

func convertToOpenAI(m Message) []openaiMessage {
	switch m.Role {
	case RoleUser:
		var (
			results  []openaiMessage
			textBuf  strings.Builder
		)
		for _, p := range m.Content {
			switch p.Kind {
			case PartToolResult:
				content := p.ToolOutput
				results = append(results, openaiMessage{
					Role:       "tool",
					ToolCallID: p.ToolID,
					Content:    &content,
				})
			case PartText:
				textBuf.WriteString(p.Text)
			}
		}
		if textBuf.Len() > 0 {
			text := textBuf.String()
			results = append(results, openaiMessage{Role: "user", Content: &text})
		}
		return results

	case RoleAssistant:
		var (
			textBuf   strings.Builder
			toolCalls []openaiToolCall
		)
		for _, p := range m.Content {
			switch p.Kind {
			case PartText:
				textBuf.WriteString(p.Text)
			case PartToolUse:
				args := string(p.ToolInput)
				if args == "" {
					args = "{}"
				}
				toolCalls = append(toolCalls, openaiToolCall{
					ID:   p.ToolID,
					Type: "function",
					Function: openaiToolCallFunc{
						Name:      p.ToolName,
						Arguments: args,
					},
				})
			}
		}
		msg := openaiMessage{Role: "assistant"}
		if textBuf.Len() > 0 {
			text := textBuf.String()
			msg.Content = &text
		}
		if len(toolCalls) > 0 {
			msg.ToolCalls = toolCalls
		}
		return []openaiMessage{msg}
	}
	return nil
}

type openaiToolAccum struct {
	id   string
	name string
	args strings.Builder
}

func (o *OpenAI) parseStream(resp *http.Response, out chan<- StreamEvent) {
	defer close(out)
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	tools := map[int]*openaiToolAccum{}
	emittedToolUse := false

	flushTools := func() {
		if len(tools) == 0 {
			return
		}
		indices := make([]int, 0, len(tools))
		for k := range tools {
			indices = append(indices, k)
		}
		sort.Ints(indices)
		for _, i := range indices {
			t := tools[i]
			args := t.args.String()
			if args == "" {
				args = "{}"
			}
			out <- StreamEvent{
				Kind: EventToolUse,
				ToolUse: &ToolUse{
					ID:    t.id,
					Name:  t.name,
					Input: json.RawMessage(args),
				},
			}
		}
		emittedToolUse = true
		tools = map[int]*openaiToolAccum{}
	}

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" || data == "[DONE]" {
			continue
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content   string `json:"content"`
					ToolCalls []struct {
						Index    int    `json:"index"`
						ID       string `json:"id"`
						Type     string `json:"type"`
						Function struct {
							Name      string `json:"name"`
							Arguments string `json:"arguments"`
						} `json:"function"`
					} `json:"tool_calls"`
				} `json:"delta"`
				FinishReason string `json:"finish_reason"`
			} `json:"choices"`
			Usage *struct {
				PromptTokens     int `json:"prompt_tokens"`
				CompletionTokens int `json:"completion_tokens"`
			} `json:"usage"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}

		if chunk.Usage != nil {
			out <- StreamEvent{
				Kind: EventUsage,
				Usage: &Usage{
					InputTokens:  chunk.Usage.PromptTokens,
					OutputTokens: chunk.Usage.CompletionTokens,
				},
			}
		}

		for _, ch := range chunk.Choices {
			if ch.Delta.Content != "" {
				out <- StreamEvent{Kind: EventText, TextDelta: ch.Delta.Content}
			}
			for _, tc := range ch.Delta.ToolCalls {
				acc, ok := tools[tc.Index]
				if !ok {
					acc = &openaiToolAccum{}
					tools[tc.Index] = acc
				}
				if tc.ID != "" {
					acc.id = tc.ID
				}
				if tc.Function.Name != "" {
					acc.name = tc.Function.Name
				}
				if tc.Function.Arguments != "" {
					acc.args.WriteString(tc.Function.Arguments)
				}
			}
			if ch.FinishReason != "" {
				if ch.FinishReason == "tool_calls" {
					flushTools()
				}
				out <- StreamEvent{Kind: EventStop, StopReason: mapOpenAIStop(ch.FinishReason)}
			}
		}
	}

	if !emittedToolUse {
		flushTools()
	}

	if err := scanner.Err(); err != nil {
		out <- StreamEvent{Kind: EventError, Err: err}
	}
}

func mapOpenAIStop(s string) StopReason {
	switch s {
	case "tool_calls":
		return StopToolUse
	case "length":
		return StopMaxTokens
	case "stop":
		return StopEndTurn
	default:
		return StopOther
	}
}
