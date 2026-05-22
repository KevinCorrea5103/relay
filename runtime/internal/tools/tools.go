package tools

import (
	"encoding/json"
	"errors"
	"fmt"
)

type Spec struct {
	Name        string         `json:"name"`
	Description string         `json:"description"`
	InputSchema map[string]any `json:"input_schema"`
}

type Handler func(input json.RawMessage) (any, error)

type Tool struct {
	Spec    Spec
	Handler Handler
}

type Registry struct {
	tools map[string]Tool
}

func (r *Registry) Get(name string) (Tool, bool) {
	t, ok := r.tools[name]
	return t, ok
}

func (r *Registry) Specs(names []string) []Spec {
	out := make([]Spec, 0, len(names))
	for _, n := range names {
		if t, ok := r.tools[n]; ok {
			out = append(out, t.Spec)
		}
	}
	return out
}

func DefaultRegistry() *Registry {
	return &Registry{tools: map[string]Tool{
		"calculator": {
			Spec: Spec{
				Name:        "calculator",
				Description: "Perform a single arithmetic operation on two numbers.",
				InputSchema: map[string]any{
					"type": "object",
					"properties": map[string]any{
						"a":  map[string]any{"type": "number"},
						"b":  map[string]any{"type": "number"},
						"op": map[string]any{"type": "string", "enum": []string{"+", "-", "*", "/"}},
					},
					"required": []string{"a", "b", "op"},
				},
			},
			Handler: calculator,
		},
	}}
}

func calculator(raw json.RawMessage) (any, error) {
	var in struct {
		A  float64 `json:"a"`
		B  float64 `json:"b"`
		Op string  `json:"op"`
	}
	if err := json.Unmarshal(raw, &in); err != nil {
		return nil, fmt.Errorf("invalid input: %w", err)
	}
	switch in.Op {
	case "+":
		return in.A + in.B, nil
	case "-":
		return in.A - in.B, nil
	case "*":
		return in.A * in.B, nil
	case "/":
		if in.B == 0 {
			return nil, errors.New("division by zero")
		}
		return in.A / in.B, nil
	default:
		return nil, fmt.Errorf("unknown op: %s", in.Op)
	}
}
