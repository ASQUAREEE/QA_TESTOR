import React, { useState } from 'react';
import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";
import { AlertCircle } from "lucide-react";

const QualityAnalysis: React.FC = () => {
  const [url, setUrl] = useState('');
  const [task, setTask] = useState('');
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const mutation = api.qualityAnalysis.analyzeWebsite.useMutation();

  const formatUrl = (input: string): string => {
    let formattedUrl = input.trim();
    if (!formattedUrl.match(/^https?:\/\//i)) {
      formattedUrl = 'https://' + formattedUrl;
    }
    try {
      const urlObject = new URL(formattedUrl);
      if (!urlObject.hostname.startsWith('www.') && !urlObject.hostname.split('.')[1]) {
        urlObject.hostname = 'www.' + urlObject.hostname;
      }
      return urlObject.toString();
    } catch {
      return formattedUrl; // Return as-is if it's not a valid URL
    }
  };

  const handleAnalysis = async () => {
    setError(null);
    setResults(null);
    
    const formattedUrl = formatUrl(url);
    
    if (task.trim() === '') {
      setError("Please enter a task to test");
      return;
    }
    
    try {
      const result = await mutation.mutateAsync({ url: formattedUrl, task });
      setResults(result);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      if (error.data?.zodError?.fieldErrors) {
        const fieldErrors = error.data.zodError.fieldErrors;
        if (fieldErrors.url) {
          setError(`URL Error: ${fieldErrors.url[0]}`);
        } else if (fieldErrors.task) {
          setError(`Task Error: ${fieldErrors.task[0]}`);
        } else {
          setError("An unexpected error occurred with the input data");
        }
      } else {
        setError(error.message || 'An unexpected error occurred');
      }
    }
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8 text-center">Website Functionality Testing</h1>
      <div className="space-y-6 mb-8">
        <Input
          type="text"
          placeholder="Enter website URL (e.g., example.com)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-3 border rounded"
        />
        <Textarea
          placeholder="Enter the task to test (e.g., 'Test the login functionality')"
          value={task}
          onChange={(e) => setTask(e.target.value)}
          rows={3}
          className="w-full p-3 border rounded"
        />
        <Button 
          onClick={handleAnalysis} 
          disabled={mutation.isLoading}
          className="w-full py-3 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          {mutation.isLoading ? 'Testing...' : 'Run Test'}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {results && (
        <div className="mt-8 space-y-8">
          <div>
            <h2 className="text-2xl font-bold mb-4">Test Results</h2>
            <pre className="whitespace-pre-wrap bg-gray-100 p-4 rounded-md overflow-auto max-h-screen text-sm">
              {results.result}
            </pre>
          </div>

          {results.screenshots && results.screenshots.length > 0 && (
            <div>
              <h3 className="text-xl font-semibold mb-4">Screenshots</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {results.screenshots.map((screenshot: string, index: number) => (
                  <div key={index} className="border rounded-md overflow-hidden">
                    <img 
                      src={`data:image/png;base64,${screenshot}`} 
                      alt={`Screenshot ${index + 1}`} 
                      className="w-full h-auto"
                    />
                    <div className="p-2 bg-gray-100 text-center">
                      Screenshot {index + 1}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default QualityAnalysis;