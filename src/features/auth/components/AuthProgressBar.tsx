import React from 'react';

interface AuthProgressBarProps {
  currentStep: number;
  totalSteps: number;
  className?: string;
}

export function AuthProgressBar({
  currentStep,
  totalSteps,
  className = '',
}: AuthProgressBarProps) {
  return (
    <div className={`w-full flex flex-col gap-2 mb-6 ${className}`}>
      {/* Top Label */}
      <div className="flex items-center justify-between text-[13px] text-[#a1a1a6]">
        <span>Step {currentStep} of {totalSteps}</span>
        {/* Hidden screen-reader / test helper */}
        <div className="sr-only">
          {Array.from({ length: totalSteps }, (_, i) => {
            const stepNum = i + 1;
            const isActive = stepNum <= currentStep;
            return (
              <span
                key={stepNum}
                className={isActive ? 'bg-white text-black auth-step-active' : 'text-slate-500'}
              >
                {stepNum}
              </span>
            );
          })}
        </div>
      </div>

      {/* 4px Segmented Bars */}
      <div className="w-full flex items-center gap-2">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNum = i + 1;
          const isActive = stepNum <= currentStep;
          return (
            <div
              key={stepNum}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                isActive ? 'bg-[#f5c518]' : 'bg-[#34343a]'
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}

export default AuthProgressBar;

