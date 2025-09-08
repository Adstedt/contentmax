'use client';

import React, { useState, useEffect } from 'react';
import { Check, Upload, Link2, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action: () => void;
  completed: boolean;
  optional?: boolean;
  value?: string;
}

export function SmartOnboarding() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [feedUrl, setFeedUrl] = useState('');
  const [googleConnected, setGoogleConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const steps: OnboardingStep[] = [
    {
      id: 'feed',
      title: 'Import Your Product Feed',
      description: 'Start by importing your product catalog. We support Google Shopping, Facebook, and XML feeds.',
      icon: <Upload className="w-5 h-5" />,
      action: async () => {
        // This would open the feed import modal
        router.push('/dashboard/import?type=feed');
      },
      completed: !!feedUrl,
      value: feedUrl
    },
    {
      id: 'google',
      title: 'Connect Google Merchant (Optional)',
      description: 'Unlock performance insights by connecting your Google Merchant Center. See CTR, conversions, and revenue data.',
      icon: <TrendingUp className="w-5 h-5" />,
      action: async () => {
        window.location.href = '/api/integrations/google/auth';
      },
      completed: googleConnected,
      optional: true,
      value: googleConnected ? 'Connected' : undefined
    },
    {
      id: 'explore',
      title: 'Explore Your Taxonomy',
      description: 'View your product categories and identify optimization opportunities.',
      icon: <Sparkles className="w-5 h-5" />,
      action: () => {
        router.push('/dashboard/taxonomy');
      },
      completed: false
    }
  ];
  
  // Check status on mount
  useEffect(() => {
    checkOnboardingStatus();
  }, []);
  
  const checkOnboardingStatus = async () => {
    try {
      // Check feed status
      const feedResponse = await fetch('/api/import/status');
      if (feedResponse.ok) {
        const feedData = await feedResponse.json();
        if (feedData.hasFeed) {
          setFeedUrl(feedData.feedUrl);
          setCurrentStep(1);
        }
      }
      
      // Check Google connection
      const googleResponse = await fetch('/api/integrations/google/status');
      if (googleResponse.ok) {
        const googleData = await googleResponse.json();
        setGoogleConnected(googleData.connected);
        if (googleData.connected && feedUrl) {
          setCurrentStep(2);
        }
      }
    } catch (error) {
      console.error('Failed to check onboarding status:', error);
    }
  };
  
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Welcome to ContentMax! 🚀</h1>
        <p className="text-gray-600">
          Let's get your product content optimized in just a few steps.
        </p>
      </div>
      
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Setup Progress</span>
          <span className="text-sm font-medium">
            {steps.filter(s => s.completed).length} / {steps.filter(s => !s.optional).length} completed
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ 
              width: `${(steps.filter(s => s.completed).length / steps.filter(s => !s.optional).length) * 100}%` 
            }}
          />
        </div>
      </div>
      
      {/* Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <Card
            key={step.id}
            className={cn(
              'p-6 transition-all duration-300',
              index === currentStep && !step.completed && 'ring-2 ring-blue-500 shadow-lg',
              step.completed && 'bg-green-50 border-green-200'
            )}
          >
            <div className="flex items-start gap-4">
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center',
                step.completed 
                  ? 'bg-green-500 text-white' 
                  : index === currentStep 
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-500'
              )}>
                {step.completed ? <Check className="w-5 h-5" /> : step.icon}
              </div>
              
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{step.title}</h3>
                  {step.optional && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      Optional
                    </span>
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-3">{step.description}</p>
                
                {step.value && (
                  <div className="text-sm text-gray-500 mb-3">
                    <span className="font-medium">Status:</span> {step.value}
                  </div>
                )}
                
                {!step.completed && index === currentStep && (
                  <Button
                    onClick={step.action}
                    disabled={loading}
                    className="flex items-center gap-2"
                  >
                    {index === 0 ? 'Import Feed' : 
                     index === 1 ? 'Connect Google' : 
                     'View Taxonomy'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                )}
                
                {step.completed && (
                  <div className="text-sm text-green-600 font-medium">
                    ✓ Completed
                  </div>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Value Propositions */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-4 text-center">
          <div className="text-2xl mb-2">📊</div>
          <h4 className="font-semibold mb-1">See Your Taxonomy</h4>
          <p className="text-sm text-gray-600">
            Visualize your product categories instantly
          </p>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl mb-2">🎯</div>
          <h4 className="font-semibold mb-1">Find Opportunities</h4>
          <p className="text-sm text-gray-600">
            {googleConnected 
              ? 'Real data shows where to improve'
              : 'Connect Google for performance insights'}
          </p>
        </Card>
        
        <Card className="p-4 text-center">
          <div className="text-2xl mb-2">✨</div>
          <h4 className="font-semibold mb-1">Generate Content</h4>
          <p className="text-sm text-gray-600">
            AI-powered content that converts
          </p>
        </Card>
      </div>
      
      {/* Skip to Dashboard */}
      {steps[0].completed && (
        <div className="mt-8 text-center">
          <Button
            variant="ghost"
            onClick={() => router.push('/dashboard')}
            className="text-gray-600"
          >
            Skip to Dashboard →
          </Button>
        </div>
      )}
    </div>
  );
}