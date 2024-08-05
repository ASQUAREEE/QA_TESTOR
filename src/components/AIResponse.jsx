import { Card, CardHeader, CardTitle, CardContent } from "~/components/ui/card"
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

// @ts-ignore
export default function AIResponse({ response }) {
  const [displayedResponse, setDisplayedResponse] = useState('')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    if (currentIndex < response.length) {
      const timer = setTimeout(() => {
        setDisplayedResponse(prev => prev + response[currentIndex])
        setCurrentIndex(prev => prev + 1)
      }, 30) // Adjust the speed of typing here

      return () => clearTimeout(timer)
    } else if (currentStep < 4) {
      const stepTimer = setTimeout(() => {
        setCurrentStep(prev => prev + 1)
      }, 1000) // Delay between steps

      return () => clearTimeout(stepTimer)
    }
  }, [currentIndex, response, currentStep])

  const LoadingSkeleton = () => (
    <div className="animate-pulse space-y-2">
      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
      <div className="h-4 bg-gray-200 rounded w-5/6"></div>
    </div>
  )

  return (
    <Card className="w-full mt-8">
      <CardHeader>
        <CardTitle>AI Copilot Response</CardTitle>
      </CardHeader>
      <CardContent>
        {displayedResponse ? (
          <>
            <p className="whitespace-pre-line">{displayedResponse}</p>
            {currentIndex < response.length && (
              <span className="inline-block w-2 h-4 bg-black dark:bg-white animate-blink"></span>
            )}
            {currentStep > 0 && (
              <div className="mt-4">
                <p className="font-semibold">Progress:</p>
                <ul className="list-disc list-inside">
                  {currentStep >= 1 && <li>Analyzing request</li>}
                  {currentStep >= 2 && <li>Generating content</li>}
                  {currentStep >= 3 && <li>Optimizing for engagement</li>}
                  {currentStep >= 4 && <li>Finalizing response</li>}
                </ul>
              </div>
            )}
          </>
        ) : (
          <LoadingSkeleton />
        )}
      </CardContent>
    </Card>
  )
}