# Amazon Bedrock & Nova Hackathon Ideas

## What is Amazon Bedrock?
Amazon Bedrock is a fully managed service that offers a choice of high-performing foundation models (FMs) from leading AI companies like AI21 Labs, Anthropic, Cohere, Meta, Mistral AI, and Amazon via a single API, along with a broad set of capabilities you need to build generative AI applications with security, privacy, and responsible AI.

 Think of it as the "App Store" or "Unified Interface" for top-tier AI models. You don't need to manage servers; you just call the API.

## What is Amazon Nova?
Amazon Nova is a new generation of foundation models developed by Amazon itself, available exclusively on Bedrock. They are designed for specific trade-offs between speed, cost, and capability:

- **Nova Micro**: Extremely fast and low-cost, text-only. Great for simple classification or summaries.
- **Nova Lite**: A balance of cost and performance. Multimodal (text, image, video inputs). fast reasoning.
- **Nova Pro**: High capability multimodal model for complex reasoning, coding, and creative work.
- **Nova Premier**: The most capable model for complex tasks (coming soon).
- **Nova Canvas**: For image generation.
- **Nova Reel**: For video generation.

## Hackathon Focus Areas
The hackathon encourages using:
1.  **Agentic AI**: Models that can use tools and reason (Nova Pro/Lite).
2.  **Multimodal**: Understanding images/video (Nova are multimodal).
3.  **UI Automation**: "Nova Act" (controlling interfaces).
4.  **Voice AI**: "Nova Sonic" (speech-to-speech).

## In This Folder
- [Idea 1: Intelligent Task Parser](./01_intelligent_task_parser.md) - Using Nova Lite for fast, accurate text-to-reminder conversion.
- [Idea 2: Voice Agent](./02_voice_agent.md) - Using Nova Sonic for hands-free reminder management.
- [Idea 3: Multimodal Reminders](./03_multimodal_reminders.md) - Using Nova's vision capabilities to turn photos into tasks.
- [Implementation Guide](./implementation_guide.md) - How to connect your React Native app to Bedrock via Supabase.
