'use client';

import { useState, useCallback } from 'react';
import { apiFetch } from '@/lib/api/fetch';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Upload,
  FileText,
  ScanLine,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
  CreditCard,
  Info,
} from 'lucide-react';

interface ReaderUploadClientProps {
  userId: string;
}

type UploadStep = 'select' | 'preview' | 'payment' | 'processing' | 'complete';

interface PDFPreview {
  name: string;
  size: number;
  pageCount: number;
  needsOCR: boolean;
}

export function ReaderUploadClient({ userId }: ReaderUploadClientProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [step, setStep] = useState<UploadStep>('select');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PDFPreview | null>(null);
  const [scriptName, setScriptName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingStatus, setProcessingStatus] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const price = preview?.needsOCR ? 8 : 5;

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.type === 'application/pdf') {
      processFile(droppedFile);
    } else {
      toast({
        title: 'Invalid file type',
        description: 'Please upload a PDF file.',
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      processFile(selectedFile);
    }
  };

  const processFile = async (selectedFile: File) => {
    setFile(selectedFile);
    setScriptName(selectedFile.name.replace('.pdf', ''));
    setError(null);

    // In production, we'd analyze the PDF here
    // For now, simulate analysis
    const mockPreview: PDFPreview = {
      name: selectedFile.name,
      size: selectedFile.size,
      pageCount: Math.floor(selectedFile.size / 5000), // Rough estimate
      needsOCR: false, // Would detect scanned pages
    };

    setPreview(mockPreview);
    setStep('preview');
  };

  const handleClearFile = () => {
    setFile(null);
    setPreview(null);
    setScriptName('');
    setStep('select');
    setError(null);
  };

  const handleProceedToPayment = () => {
    if (!scriptName.trim()) {
      toast({
        title: 'Name required',
        description: 'Please enter a name for this script.',
        variant: 'destructive',
      });
      return;
    }
    setStep('payment');
  };

  const handlePayAndProcess = async () => {
    setIsUploading(true);
    setStep('processing');
    setError(null);

    try {
      // Step 1: Create payment intent
      setProcessingStatus('Creating payment...');
      setUploadProgress(10);

      const paymentResponse = await apiFetch('/api/reader/upload/create-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          price,
          needsOCR: preview?.needsOCR,
        }),
      });

      if (!paymentResponse.ok) {
        throw new Error('Payment failed');
      }

      // Step 2: Upload file
      setProcessingStatus('Uploading script...');
      setUploadProgress(30);

      const formData = new FormData();
      formData.append('file', file!);
      formData.append('name', scriptName);
      formData.append('needsOCR', String(preview?.needsOCR || false));

      const uploadResponse = await apiFetch('/api/reader/upload/process', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error('Upload failed');
      }

      const { projectId, jobId } = await uploadResponse.json();

      // Step 3: Monitor processing
      setProcessingStatus('Parsing script...');
      setUploadProgress(50);

      // Poll for completion
      let attempts = 0;
      const maxAttempts = 60; // 5 minutes max

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        attempts++;

        const statusResponse = await apiFetch(`/api/jobs/${jobId}/status`);
        const { status, progress, message } = await statusResponse.json();

        setProcessingStatus(message || 'Processing...');
        setUploadProgress(50 + (progress || 0) * 0.5);

        if (status === 'completed') {
          setStep('complete');
          setUploadProgress(100);
          return;
        }

        if (status === 'failed') {
          throw new Error(message || 'Processing failed');
        }
      }

      throw new Error('Processing timed out');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setStep('preview');
      toast({
        title: 'Processing failed',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        <div className={`flex items-center gap-2 ${step === 'select' ? 'text-violet-600' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'select' ? 'bg-violet-100 text-violet-600' :
            ['preview', 'payment', 'processing', 'complete'].includes(step) ? 'bg-green-100 text-green-600' : 'bg-muted'
          }`}>
            {['preview', 'payment', 'processing', 'complete'].includes(step) ? (
              <CheckCircle className="w-4 h-4" />
            ) : '1'}
          </div>
          <span className="text-sm font-medium">Select</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className={`flex items-center gap-2 ${step === 'preview' ? 'text-violet-600' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'preview' ? 'bg-violet-100 text-violet-600' :
            ['payment', 'processing', 'complete'].includes(step) ? 'bg-green-100 text-green-600' : 'bg-muted'
          }`}>
            {['payment', 'processing', 'complete'].includes(step) ? (
              <CheckCircle className="w-4 h-4" />
            ) : '2'}
          </div>
          <span className="text-sm font-medium">Review</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className={`flex items-center gap-2 ${step === 'payment' ? 'text-violet-600' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'payment' ? 'bg-violet-100 text-violet-600' :
            ['processing', 'complete'].includes(step) ? 'bg-green-100 text-green-600' : 'bg-muted'
          }`}>
            {['processing', 'complete'].includes(step) ? (
              <CheckCircle className="w-4 h-4" />
            ) : '3'}
          </div>
          <span className="text-sm font-medium">Pay</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className={`flex items-center gap-2 ${['processing', 'complete'].includes(step) ? 'text-violet-600' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
            step === 'complete' ? 'bg-green-100 text-green-600' :
            step === 'processing' ? 'bg-violet-100 text-violet-600' : 'bg-muted'
          }`}>
            {step === 'complete' ? <CheckCircle className="w-4 h-4" /> : '4'}
          </div>
          <span className="text-sm font-medium">Done</span>
        </div>
      </div>

      {/* Step: Select File */}
      {step === 'select' && (
        <Card>
          <CardHeader>
            <CardTitle>Upload PDF Script</CardTitle>
            <CardDescription>
              Upload a screenplay in PDF format. Scanned documents require OCR processing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                isDragging
                  ? 'border-violet-500 bg-violet-50 dark:bg-violet-950'
                  : 'border-border hover:border-violet-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg font-medium mb-2">
                Drag and drop your PDF here
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                or click to browse
              </p>
              <label>
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <Button variant="outline" asChild>
                  <span>Select PDF File</span>
                </Button>
              </label>
            </div>

            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="font-medium flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-blue-500" />
                Pricing
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Standard PDF (text-based)</span>
                  <span className="font-medium">$5</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Scanned PDF (requires OCR)</span>
                  <span className="font-medium">$8</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Preview */}
      {step === 'preview' && preview && (
        <Card>
          <CardHeader>
            <CardTitle>Review Your Script</CardTitle>
            <CardDescription>
              Confirm the details before processing
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* File info */}
            <div className="flex items-start gap-4 p-4 bg-muted rounded-lg">
              <div className="w-12 h-12 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0">
                <FileText className="w-6 h-6 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{preview.name}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(preview.size)} • ~{preview.pageCount} pages
                </p>
                {preview.needsOCR && (
                  <Badge variant="secondary" className="mt-2">
                    <ScanLine className="w-3 h-3 mr-1" />
                    Requires OCR
                  </Badge>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={handleClearFile}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Script name input */}
            <div className="space-y-2">
              <Label htmlFor="script-name">Script Name</Label>
              <Input
                id="script-name"
                value={scriptName}
                onChange={(e) => setScriptName(e.target.value)}
                placeholder="Enter a name for this script"
              />
            </div>

            {/* Error display */}
            {error && (
              <div className="flex items-start gap-2 p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800 dark:text-red-200">Error</p>
                  <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                </div>
              </div>
            )}

            {/* Price summary */}
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Total</p>
                <p className="text-sm text-muted-foreground">
                  {preview.needsOCR ? 'OCR processing included' : 'Standard processing'}
                </p>
              </div>
              <p className="text-2xl font-bold">${price}</p>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleClearFile}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={handleProceedToPayment}>
                Continue to Payment
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step: Payment */}
      {step === 'payment' && (
        <Card>
          <CardHeader>
            <CardTitle>Payment</CardTitle>
            <CardDescription>
              Secure payment powered by Stripe
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Order summary */}
            <div className="p-4 bg-muted rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{scriptName}</span>
                <span>${price}.00</span>
              </div>
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Total</span>
                <span>${price}.00</span>
              </div>
            </div>

            {/* Payment form placeholder - would integrate Stripe Elements */}
            <div className="p-4 border rounded-lg space-y-4">
              <div className="space-y-2">
                <Label>Card Number</Label>
                <Input placeholder="1234 5678 9012 3456" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Expiry</Label>
                  <Input placeholder="MM/YY" />
                </div>
                <div className="space-y-2">
                  <Label>CVC</Label>
                  <Input placeholder="123" />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setStep('preview')}>
                Back
              </Button>
              <Button className="flex-1" onClick={handlePayAndProcess}>
                <CreditCard className="w-4 h-4 mr-2" />
                Pay ${price} & Process
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Your payment is secured with 256-bit SSL encryption
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step: Processing */}
      {step === 'processing' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Loader2 className="w-12 h-12 text-violet-600 animate-spin mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Processing Your Script</h3>
            <p className="text-muted-foreground mb-6">{processingStatus}</p>
            <Progress value={uploadProgress} className="max-w-xs mx-auto" />
            <p className="text-sm text-muted-foreground mt-2">
              This may take a few minutes. You can leave this page.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step: Complete */}
      {step === 'complete' && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium mb-2">Script Processed Successfully!</h3>
            <p className="text-muted-foreground mb-6">
              &ldquo;{scriptName}&rdquo; has been added to your library
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => router.push('/reader/upload')}>
                Upload Another
              </Button>
              <Button onClick={() => router.push('/reader/dashboard')}>
                Go to Library
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
