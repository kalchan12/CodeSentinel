"use client";

import { useState } from "react";
import { toast } from "sonner";

export default function SettingsPage() {
  const [provider, setProvider] = useState("local");
  const [baseUrl, setBaseUrl] = useState("http://localhost:11434/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("llama3");
  const [enabled, setEnabled] = useState(true);

  const handleSave = () => {
    toast.success("AI settings saved successfully.");
  };

  return (
    <div className="max-w-[800px] mx-auto space-y-lg">
      <header className="flex justify-between items-end border-b border-outline-variant pb-md">
        <div>
          <div className="flex items-center gap-sm mb-xs">
            <span className="material-symbols-outlined text-primary text-[28px]">settings</span>
            <h2 className="text-[24px] font-semibold text-on-surface">Settings</h2>
          </div>
          <p className="text-on-surface-variant">Configure CodeSentinel and AI provider preferences.</p>
        </div>
      </header>

      <div className="space-y-xl">
        <section className="space-y-md">
          <h3 className="text-lg font-medium text-on-surface border-b border-outline-variant pb-2">AI Assistance Layer</h3>
          <p className="text-sm text-on-surface-variant mb-4">
            CodeSentinel functions entirely locally by default. You can enable optional AI features for explanation, triage assistance, and remediation advice.
          </p>
          
          <div className="p-md rounded-lg border border-outline-variant bg-surface-container-low space-y-md">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-on-surface">Enable AI Features</div>
                <div className="text-sm text-on-surface-variant">Use an LLM to enrich finding details.</div>
              </div>
              <button 
                onClick={() => setEnabled(!enabled)}
                className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${enabled ? 'bg-primary' : 'bg-surface-container-highest'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-surface transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {enabled && (
              <div className="space-y-sm pt-md border-t border-outline-variant mt-md">
                <div className="grid grid-cols-4 gap-4 items-center">
                  <label className="text-sm font-medium text-on-surface text-right">Provider</label>
                  <select 
                    value={provider}
                    onChange={(e) => setProvider(e.target.value)}
                    className="col-span-3 bg-background border border-outline-variant rounded-md px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value="local">Local Inference (Ollama / LM Studio)</option>
                    <option value="openai">OpenAI (Cloud)</option>
                    <option value="anthropic">Anthropic (Cloud)</option>
                    <option value="opencode">OpenCode (Cloud)</option>
                  </select>
                </div>

                <div className="grid grid-cols-4 gap-4 items-center">
                  <label className="text-sm font-medium text-on-surface text-right">Base URL</label>
                  <input 
                    type="text" 
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    className="col-span-3 bg-background border border-outline-variant rounded-md px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="https://api.openai.com/v1"
                  />
                </div>

                <div className="grid grid-cols-4 gap-4 items-center">
                  <label className="text-sm font-medium text-on-surface text-right">Model Name</label>
                  <input 
                    type="text" 
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="col-span-3 bg-background border border-outline-variant rounded-md px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="e.g. gpt-4o-mini, llama3"
                  />
                </div>

                <div className="grid grid-cols-4 gap-4 items-center">
                  <label className="text-sm font-medium text-on-surface text-right">API Key</label>
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="col-span-3 bg-background border border-outline-variant rounded-md px-3 py-2 text-sm focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                    placeholder="Leave empty for local models if not required"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end pt-sm">
            <button 
              onClick={handleSave}
              className="bg-primary text-on-primary px-6 py-2 rounded-md text-sm font-medium hover:bg-primary-container hover:text-on-primary-container transition-colors"
            >
              Save Settings
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
