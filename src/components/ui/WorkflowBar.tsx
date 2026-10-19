import { ReactNode } from 'react';
import { Check, Lock, ChevronRight } from 'lucide-react';

export interface WorkflowStep {
  key: string;
  label: string;
  state: 'done' | 'current' | 'locked';
  hint?: string;
  actions?: ReactNode;
}

export default function WorkflowBar({ steps }: { steps: WorkflowStep[] }) {
  const currentStep = steps.find((s) => s.state === 'current');
  return (
    <div className="space-y-4">
      <div className="flex items-stretch overflow-x-auto scrollbar-hide gap-0">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-stretch flex-shrink-0">
            <div
              className={`flex items-center gap-2.5 px-4 py-3 rounded-xl transition-all ${
                step.state === 'current'
                  ? 'bg-primary-50 dark:bg-primary-500/15 border border-primary-200 dark:border-primary-500/30'
                  : step.state === 'done'
                    ? 'text-success-600 dark:text-success-400'
                    : 'text-ink-400 dark:text-ink-500'
              }`}
              title={step.state === 'locked' ? step.hint : undefined}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  step.state === 'done'
                    ? 'bg-success-500 text-white'
                    : step.state === 'current'
                      ? 'bg-primary-600 text-white'
                      : 'bg-ink-100 dark:bg-ink-800 text-ink-400 dark:text-ink-500'
                }`}
              >
                {step.state === 'done' ? <Check className="w-4 h-4" /> : step.state === 'locked' ? <Lock className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-semibold whitespace-nowrap ${step.state === 'current' ? 'text-primary-700 dark:text-primary-300' : ''}`}>{step.label}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className="flex items-center flex-shrink-0">
                <ChevronRight className={`w-4 h-4 ${step.state === 'done' ? 'text-success-500' : 'text-ink-300 dark:text-ink-700'}`} />
              </div>
            )}
          </div>
        ))}
      </div>

      {currentStep && (
        <div className="p-4 rounded-xl bg-primary-50/60 dark:bg-primary-500/10 border border-primary-100 dark:border-primary-500/20">
          <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2.5">Current step: {currentStep.label}</p>
          {currentStep.actions ?? (
            <p className="text-xs text-ink-500 dark:text-ink-400">
              {currentStep.hint || 'No action needed right now — this step completes automatically.'}
            </p>
          )}
        </div>
      )}

      {!currentStep && steps.length > 0 && (
        <div className="p-4 rounded-xl bg-success-50 dark:bg-success-500/10 border border-success-100 dark:border-success-500/20 text-center">
          <Check className="w-5 h-5 text-success-500 mx-auto mb-1" />
          <p className="text-xs font-semibold text-success-700 dark:text-success-400">All steps completed</p>
        </div>
      )}
    </div>
  );
}
