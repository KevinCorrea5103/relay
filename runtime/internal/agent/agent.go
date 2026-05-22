package agent

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/relay/runtime/internal/callback"
	"github.com/relay/runtime/internal/providers"
	"github.com/relay/runtime/internal/tools"
)

const maxIterations = 8

type RunRequest struct {
	RunID       string          `json:"runId"`
	Model       string          `json:"model"`
	System      string          `json:"system,omitempty"`
	Input       string          `json:"input"`
	Tools       []RequestedTool `json:"tools,omitempty"`
	Credentials *Credentials    `json:"credentials,omitempty"`
}

type Credentials struct {
	Provider string `json:"provider"`
	APIKey   string `json:"apiKey"`
	BaseURL  string `json:"baseUrl,omitempty"`
}

type RequestedTool struct {
	Name        string         `json:"name"`
	Kind        string         `json:"kind"`
	Description string         `json:"description,omitempty"`
	InputSchema map[string]any `json:"inputSchema,omitempty"`
}

type Event struct {
	Type    string `json:"type"`
	Text    string `json:"text,omitempty"`
	ID      string `json:"id,omitempty"`
	Name    string `json:"name,omitempty"`
	Input   any    `json:"input,omitempty"`
	Output  any    `json:"output,omitempty"`
	Message string `json:"message,omitempty"`
	Usage   *Usage `json:"usage,omitempty"`
}

type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type Emitter func(Event)

type Runner struct {
	registry *tools.Registry
	callback *callback.Client
}

func NewRunner(registry *tools.Registry, cb *callback.Client) *Runner {
	return &Runner{registry: registry, callback: cb}
}

func (r *Runner) Run(ctx context.Context, req RunRequest, emit Emitter) {
	if req.Credentials == nil {
		emit(Event{Type: "error", Message: "credentials are required"})
		return
	}

	name, modelName, err := providers.Detect(req.Model)
	if err != nil {
		emit(Event{Type: "error", Message: err.Error()})
		return
	}

	if providers.Name(req.Credentials.Provider) != name {
		emit(Event{Type: "error", Message: fmt.Sprintf(
			"credentials provider %q does not match model provider %q",
			req.Credentials.Provider, name)})
		return
	}

	provider, err := providers.Build(name, req.Credentials.APIKey, req.Credentials.BaseURL)
	if err != nil {
		emit(Event{Type: "error", Message: err.Error()})
		return
	}

	providerTools := make([]providers.ToolSpec, 0, len(req.Tools))
	customNames := map[string]bool{}
	for _, t := range req.Tools {
		switch t.Kind {
		case "function":
			providerTools = append(providerTools, providers.ToolSpec{
				Name:        t.Name,
				Description: t.Description,
				InputSchema: t.InputSchema,
			})
			customNames[t.Name] = true
		case "builtin", "":
			b, ok := r.registry.Get(t.Name)
			if !ok {
				emit(Event{Type: "error", Message: fmt.Sprintf("unknown builtin tool %q", t.Name)})
				return
			}
			providerTools = append(providerTools, providers.ToolSpec{
				Name:        b.Spec.Name,
				Description: b.Spec.Description,
				InputSchema: b.Spec.InputSchema,
			})
		default:
			emit(Event{Type: "error", Message: fmt.Sprintf("unknown tool kind %q", t.Kind)})
			return
		}
	}

	if len(customNames) > 0 && (req.RunID == "" || r.callback == nil) {
		emit(Event{Type: "error", Message: "function tools require runId and a callback client"})
		return
	}

	messages := []providers.Message{
		{
			Role:    providers.RoleUser,
			Content: []providers.ContentPart{{Kind: providers.PartText, Text: req.Input}},
		},
	}

	var finalText string
	var totalUsage Usage

	for i := 0; i < maxIterations; i++ {
		stream, err := provider.Stream(ctx, providers.StreamRequest{
			Model:    modelName,
			System:   req.System,
			Messages: messages,
			Tools:    providerTools,
		})
		if err != nil {
			emit(Event{Type: "error", Message: err.Error()})
			return
		}

		var (
			textBuf    string
			toolUses   []providers.ToolUse
			stopReason providers.StopReason
		)

		for evt := range stream {
			switch evt.Kind {
			case providers.EventText:
				textBuf += evt.TextDelta
				emit(Event{Type: "token", Text: evt.TextDelta})
			case providers.EventToolUse:
				if evt.ToolUse != nil {
					toolUses = append(toolUses, *evt.ToolUse)
				}
			case providers.EventStop:
				stopReason = evt.StopReason
			case providers.EventUsage:
				if evt.Usage != nil {
					totalUsage.InputTokens += evt.Usage.InputTokens
					totalUsage.OutputTokens += evt.Usage.OutputTokens
				}
			case providers.EventError:
				msg := "stream error"
				if evt.Err != nil {
					msg = evt.Err.Error()
				}
				emit(Event{Type: "error", Message: msg})
				return
			}
		}

		if stopReason != providers.StopToolUse || len(toolUses) == 0 {
			finalText = textBuf
			break
		}

		assistantContent := []providers.ContentPart{}
		if textBuf != "" {
			assistantContent = append(assistantContent, providers.ContentPart{
				Kind: providers.PartText,
				Text: textBuf,
			})
		}
		for _, tu := range toolUses {
			assistantContent = append(assistantContent, providers.ContentPart{
				Kind:      providers.PartToolUse,
				ToolID:    tu.ID,
				ToolName:  tu.Name,
				ToolInput: tu.Input,
			})
		}
		messages = append(messages, providers.Message{
			Role:    providers.RoleAssistant,
			Content: assistantContent,
		})

		userContent := []providers.ContentPart{}
		for _, tu := range toolUses {
			var inputAny any
			_ = json.Unmarshal(tu.Input, &inputAny)
			emit(Event{Type: "tool_call", ID: tu.ID, Name: tu.Name, Input: inputAny})

			var resultStr string
			var resultAny any

			if customNames[tu.Name] {
				output, err := r.callback.WaitToolResult(ctx, req.RunID, tu.ID)
				if err != nil {
					resultStr = "error: " + err.Error()
					resultAny = resultStr
				} else {
					resultAny = output
					b, _ := json.Marshal(output)
					resultStr = string(b)
				}
			} else if b, ok := r.registry.Get(tu.Name); ok {
				output, err := b.Handler(tu.Input)
				if err != nil {
					resultStr = "error: " + err.Error()
					resultAny = resultStr
				} else {
					resultAny = output
					raw, _ := json.Marshal(output)
					resultStr = string(raw)
				}
			} else {
				resultStr = fmt.Sprintf("error: unknown tool %q", tu.Name)
				resultAny = resultStr
			}

			emit(Event{Type: "tool_result", ID: tu.ID, Output: resultAny})

			userContent = append(userContent, providers.ContentPart{
				Kind:       providers.PartToolResult,
				ToolID:     tu.ID,
				ToolOutput: resultStr,
			})
		}
		messages = append(messages, providers.Message{
			Role:    providers.RoleUser,
			Content: userContent,
		})
	}

	done := Event{Type: "done", Output: finalText}
	if totalUsage.InputTokens > 0 || totalUsage.OutputTokens > 0 {
		done.Usage = &totalUsage
	}
	emit(done)
}
