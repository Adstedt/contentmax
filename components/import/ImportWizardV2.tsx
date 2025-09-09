'use client';

import { useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ChevronLeft, ChevronRight, Check, X } from 'lucide-react';
import { ImportSourceSelector } from './steps/ImportSourceSelector';
import { ImportValidator } from './steps/ImportValidator';
import { ImportFieldMapper } from './steps/ImportFieldMapper';
import { ImportOptions } from './steps/ImportOptions';
import { ImportProgress } from './steps/ImportProgress';
import { ImportResults } from './steps/ImportResults';

export type ImportWizardStep =
  | 'source-selection'
  | 'validation-preview'
  | 'field-mapping'
  | 'import-options'
  | 'processing'
  | 'review-results';

interface WizardStep {
  id: ImportWizardStep;
  title: string;
  description: string;
  component: React.ComponentType<any>;
  canSkip?: boolean;
}

const WIZARD_STEPS: WizardStep[] = [
  {
    id: 'source-selection',
    title: 'Select Source',
    description: 'Choose how to import your product data',
    component: ImportSourceSelector,
  },
  {
    id: 'validation-preview',
    title: 'Validate & Preview',
    description: 'Check data quality and preview import',
    component: ImportValidator,
  },
  {
    id: 'field-mapping',
    title: 'Map Fields',
    description: 'Map your data fields to our schema',
    component: ImportFieldMapper,
    canSkip: true,
  },
  {
    id: 'import-options',
    title: 'Configure Import',
    description: 'Set import options and preferences',
    component: ImportOptions,
    canSkip: true,
  },
  {
    id: 'processing',
    title: 'Import Progress',
    description: 'Importing your products',
    component: ImportProgress,
  },
  {
    id: 'review-results',
    title: 'Review Results',
    description: 'Import complete',
    component: ImportResults,
  },
];

interface ImportWizardV2Props {
  onClose?: () => void;
  onComplete?: (data: any) => void;
  projectId?: string;
}

export function ImportWizardV2({ onClose, onComplete, projectId }: ImportWizardV2Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState<Record<string, any>>({});
  const [stepValidation, setStepValidation] = useState<Record<number, boolean>>({});
  const [isProcessing, setIsProcessing] = useState(false);

  const currentStepConfig = WIZARD_STEPS[currentStep];
  const StepComponent = currentStepConfig.component;
  const progress = ((currentStep + 1) / WIZARD_STEPS.length) * 100;

  const handleStepData = useCallback(
    (data: any) => {
      setWizardData((prev) => ({
        ...prev,
        [currentStepConfig.id]: data,
      }));
    },
    [currentStepConfig.id]
  );

  const handleValidation = useCallback(
    (isValid: boolean) => {
      setStepValidation((prev) => ({
        ...prev,
        [currentStep]: isValid,
      }));
    },
    [currentStep]
  );

  const canGoNext = () => {
    if (currentStepConfig.canSkip) return true;
    return stepValidation[currentStep] === true;
  };

  const goToNext = () => {
    if (currentStep < WIZARD_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else if (onComplete) {
      onComplete(wizardData);
    }
  };

  const goToPrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const goToStep = (stepIndex: number) => {
    // Only allow going to previous steps or validated steps
    if (stepIndex <= currentStep) {
      setCurrentStep(stepIndex);
    } else {
      // Check if all intermediate steps are validated
      let canNavigate = true;
      for (let i = currentStep; i < stepIndex; i++) {
        if (!WIZARD_STEPS[i].canSkip && !stepValidation[i]) {
          canNavigate = false;
          break;
        }
      }
      if (canNavigate) {
        setCurrentStep(stepIndex);
      }
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-white">
      {/* Header */}
      <div className="border-b border-[#2a2a2a] p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold">Import Products</h2>
              <p className="text-[#999] mt-1">{currentStepConfig.description}</p>
            </div>
            {onClose && (
              <Button variant="ghost" size="icon" onClick={onClose} className="hover:bg-[#1a1a1a]">
                <X className="h-5 w-5" />
              </Button>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-2">
            <Progress value={progress} className="h-2 bg-[#1a1a1a]" />
            <div className="flex justify-between text-xs text-[#666]">
              <span>
                Step {currentStep + 1} of {WIZARD_STEPS.length}
              </span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
          </div>

          {/* Step Indicators */}
          <div className="flex items-center justify-between mt-6">
            {WIZARD_STEPS.map((step, index) => {
              const isActive = index === currentStep;
              const isCompleted = index < currentStep || stepValidation[index];
              const isClickable = index <= currentStep || isCompleted;

              return (
                <button
                  key={step.id}
                  onClick={() => isClickable && goToStep(index)}
                  disabled={!isClickable}
                  className={cn(
                    'flex flex-col items-center gap-2 px-2 py-1 rounded-lg transition-all',
                    isClickable && 'cursor-pointer hover:bg-[#1a1a1a]',
                    !isClickable && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all',
                      isActive && 'border-[#10a37f] bg-[#10a37f] text-white',
                      isCompleted && !isActive && 'border-[#10a37f] bg-[#1a1a1a] text-[#10a37f]',
                      !isActive && !isCompleted && 'border-[#2a2a2a] bg-[#1a1a1a] text-[#666]'
                    )}
                  >
                    {isCompleted && !isActive ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <span className="text-sm font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs font-medium hidden sm:block',
                      isActive && 'text-white',
                      !isActive && 'text-[#666]'
                    )}
                  >
                    {step.title}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto p-6">
          <StepComponent
            data={wizardData[currentStepConfig.id] || {}}
            allData={wizardData}
            onDataChange={handleStepData}
            onValidation={handleValidation}
            projectId={projectId}
            isProcessing={isProcessing}
            setIsProcessing={setIsProcessing}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-[#2a2a2a] p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Button
            variant="outline"
            onClick={goToPrevious}
            disabled={currentStep === 0 || isProcessing}
            className="bg-[#0a0a0a] hover:bg-[#1a1a1a] text-white border-[#2a2a2a]"
          >
            <ChevronLeft className="w-4 h-4 mr-2" />
            Previous
          </Button>

          <div className="flex gap-2">
            {currentStepConfig.canSkip && (
              <Button
                variant="ghost"
                onClick={goToNext}
                disabled={isProcessing}
                className="hover:bg-[#1a1a1a] text-[#999]"
              >
                Skip
              </Button>
            )}

            <Button
              onClick={goToNext}
              disabled={!canGoNext() || isProcessing}
              className="bg-[#10a37f] hover:bg-[#0e8a6b] text-white disabled:opacity-50"
            >
              {currentStep === WIZARD_STEPS.length - 1 ? (
                <>
                  Complete
                  <Check className="w-4 h-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
