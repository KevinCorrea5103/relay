package providers

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

const (
	anthropicDefaultURL = "https://api.anthropic.com/v1/messages"
	anthropicVersion    = "2023-06-01"
)

type Anthropic struct {
	apiKey string
	url    string
	client *http.Client
}

func NewAnthropic(apiKey string) *Anthropic {
	return &Anthropic{apiKey: apiKey, url: anthropicDefaultURL, client: http.DefaultClient}
}

type anthropicMessage struct {
	Role    string                  `json:"role"`
	Content []anthropicContentBlock `json:"content"`
}

type anthropicContentBlock struct {
	Type      string          `json:"type"`
	Text      string          `json:"text,omitempty"`
	ID        string          `json:"id,omitempty"`
	Name      string          `json:"name,omitempty"`
	Input     json.RawMessage `json:"input,omitempty"`
	ToolUseID string          `json:"tool_use_id,omitempty"`
	Content   string          `json:"content,omitempty"`
}

func (a *Anthropic) Stream(ctx context.Context, req StreamRequest) (<-chan StreamEvent, error) {
	maxTokens := req.MaxTokens
	if maxTokens == 0 {
		maxTokens = 1024
	}

	messages := make([]anthropicMessage, len(req.Messages))
	for i, m := range req.Messages {
		blocks := make([]anthropicContentBlock, 0, len(m.Content))
		for _, p := range m.Content {
			switch p.Kind {
			case PartText:
				blocks = append(blocks, anthropicContentBlock{Type: "text", Text: p.Text})
			case PartToolUse:
				blocks = append(blocks, anthropicContentBlock{
					Type:  "tool_use",
					ID:    p.ToolID,
					Name:  p.ToolName,
					Input: p.ToolInput,
				})
			case PartToolResult:
				blocks = append(blocks, anthropicContentBlock{
					Type:      "tool_result",
					ToolUseID: p.ToolID,
					Content:   p.ToolOutput,
				})
			}
		}
		messages[i] = anthropicMessage{Role: string(m.Role), Content: blocks}
	}

	payload := map[string]any{
		"model":      req.Model,
		"max_tokens": maxTokens,
		"messages":   messages,
		"stream":     true,
	}
	if req.System != "" {
		payload["system"] = req.System
	}
	if len(req.Tools) > 0 {
		payload["tools"] = req.Tools
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", a.url, bytes.NewReader(body))
	if err != nil {
		return nil, err
	}
	httpReq.Header.Set("x-api-key", a.apiKey)
	httpReq.Header.Set("anthropic-version", anthropicVersion)
	httpReq.Header.Set("content-type", "application/json")
	httpReq.Header.Set("accept", "text/event-stream")

	resp, err := a.client.Do(httpReq)
	if err != nil {
		return nil, err
	}
	if resp.StatusCode >= 400 {
		defer resp.Body.Close()
		errBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("anthropic %d: %s", resp.StatusCode, string(errBody))
	}

	out := make(chan StreamEvent, 16)
	go a.parseStream(resp, out)
	return out, nil
}

type anthropicBlockAccum struct {
	kind  string
	id    string
	name  string
	input strings.Builder
}

func (a *Anthropic) parseStream(resp *http.Response, out chan<- StreamEvent) {
	defer close(out)
	defer resp.Body.Close()

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 0, 64*1024), 1024*1024)

	blocks := map[int]*anthropicBlockAccum{}

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "" {
			continue
		}

		var evt struct {
			Type         string `json:"type"`
			Index        int    `json:"index"`
			ContentBlock *struct {
				Type  string          `json:"type"`
				ID    string          `json:"id"`
				Name  string          `json:"name"`
				Input json.RawMessage `json:"input"`
				Text  string          `json:"text"`
			} `json:"content_block"`
			Delta *struct {
				Type        string `json:"type"`
				Text        string `json:"text"`
				PartialJSON string `json:"partial_json"`
				StopReason  string `json:"stop_reason"`
			} `json:"delta"`
			Usage *Usage `json:"usage"`
		}
		if err := json.Unmarshal([]byte(data), &evt); err != nil {
			continue
		}

		switch evt.Type {
		case "content_block_start":
			if evt.ContentBlock == nil {
				continue
			}
			blocks[evt.Index] = &anthropicBlockAccum{
				kind: evt.ContentBlock.Type,
				id:   evt.ContentBlock.ID,
				name: evt.ContentBlock.Name,
			}

		case "content_block_delta":
			if evt.Delta == nil {
				continue
			}
			switch evt.Delta.Type {
			case "text_delta":
				out <- StreamEvent{Kind: EventText, TextDelta: evt.Delta.Text}
			case "input_json_delta":
				if b, ok := blocks[evt.Index]; ok {
					b.input.WriteString(evt.Delta.PartialJSON)
				}
			}

		case "content_block_stop":
			b, ok := blocks[evt.Index]
			if !ok {
				continue
			}
			if b.kind == "tool_use" {
				input := b.input.String()
				if input == "" {
					input = "{}"
				}
				out <- StreamEvent{
					Kind: EventToolUse,
					ToolUse: &ToolUse{
						ID:    b.id,
						Name:  b.name,
						Input: json.RawMessage(input),
					},
				}
			}
			delete(blocks, evt.Index)

		case "message_delta":
			if evt.Delta != nil && evt.Delta.StopReason != "" {
				out <- StreamEvent{Kind: EventStop, StopReason: mapAnthropicStop(evt.Delta.StopReason)}
			}
			if evt.Usage != nil {
				out <- StreamEvent{Kind: EventUsage, Usage: evt.Usage}
			}

		case "message_stop":
			return
		}
	}

	if err := scanner.Err(); err != nil {
		out <- StreamEvent{Kind: EventError, Err: err}
	}
}

func mapAnthropicStop(s string) StopReason {
	switch s {
	case "tool_use":
		return StopToolUse
	case "max_tokens":
		return StopMaxTokens
	case "end_turn", "stop_sequence":
		return StopEndTurn
	default:
		return StopOther
	}
}
