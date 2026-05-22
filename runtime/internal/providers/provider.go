package providers

import (
	"context"
	"encoding/json"
)

type Role string

const (
	RoleUser      Role = "user"
	RoleAssistant Role = "assistant"
)

type PartKind string

const (
	PartText       PartKind = "text"
	PartToolUse    PartKind = "tool_use"
	PartToolResult PartKind = "tool_result"
)

type Message struct {
	Role    Role
	Content []ContentPart
}

type ContentPart struct {
	Kind       PartKind
	Text       string
	ToolID     string
	ToolName   string
	ToolInput  json.RawMessage
	ToolOutput string
}

type ToolSpec struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"input_schema"`
}

type ToolUse struct {
	ID    string
	Name  string
	Input json.RawMessage
}

type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

type StreamRequest struct {
	Model     string
	System    string
	Messages  []Message
	Tools     []ToolSpec
	MaxTokens int
}

type EventKind string

const (
	EventText    EventKind = "text"
	EventToolUse EventKind = "tool_use"
	EventStop    EventKind = "stop"
	EventUsage   EventKind = "usage"
	EventError   EventKind = "error"
)

type StopReason string

const (
	StopEndTurn   StopReason = "end_turn"
	StopToolUse   StopReason = "tool_use"
	StopMaxTokens StopReason = "max_tokens"
	StopOther     StopReason = "other"
)

type StreamEvent struct {
	Kind       EventKind
	TextDelta  string
	ToolUse    *ToolUse
	StopReason StopReason
	Usage      *Usage
	Err        error
}

type Provider interface {
	Stream(ctx context.Context, req StreamRequest) (<-chan StreamEvent, error)
}
