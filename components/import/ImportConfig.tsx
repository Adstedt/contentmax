'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/RadioGroup';
import { Textarea } from '@/components/ui/Textarea';
import { Card } from '@/components/ui/Card';
import { ImportConfiguration, SitemapPreview } from './ImportWizard';
import { Settings, Zap, Filter, AlertCircle } from 'lucide-react';

interface ImportConfigProps {
  sitemapData: SitemapPreview;
  initialConfig: ImportConfiguration;
  onNext: (config: ImportConfiguration) => void;
  onBack: () => void;
}