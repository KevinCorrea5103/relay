package providers

import (
	"fmt"
	"strings"
)

type Name string

const (
	NameAnthropic Name = "anthropic"
	NameOpenAI    Name = "openai"
)

func Detect(model string) (Name, string, error) {
	if strings.HasPrefix(model, "anthropic:") {
		return NameAnthropic, strings.TrimPrefix(model, "anthropic:"), nil
	}
	if strings.HasPrefix(model, "openai:") {
		return NameOpenAI, strings.TrimPrefix(model, "openai:"), nil
	}
	switch {
	case strings.HasPrefix(model, "claude-"):
		return NameAnthropic, model, nil
	case strings.HasPrefix(model, "gpt-"),
		strings.HasPrefix(model, "chatgpt-"),
		strings.HasPrefix(model, "o1-"), model == "o1",
		strings.HasPrefix(model, "o3-"), model == "o3",
		strings.HasPrefix(model, "o4-"):
		return NameOpenAI, model, nil
	}
	return "", "", fmt.Errorf("cannot route model %q: unknown family", model)
}

func Build(name Name, apiKey, baseURL string) (Provider, error) {
	if apiKey == "" {
		return nil, fmt.Errorf("%s: apiKey is required", name)
	}
	switch name {
	case NameAnthropic:
		return NewAnthropic(apiKey), nil
	case NameOpenAI:
		return NewOpenAI(apiKey, baseURL), nil
	}
	return nil, fmt.Errorf("unknown provider %q", name)
}
