import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Textarea } from '~/components/ui/textarea'
import { Card, CardHeader, CardTitle, CardContent } from '~/components/ui/card'
import { Loader2, Copy, Check } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { toast } from '~/components/ui/use-toast'
import { Alert, AlertDescription } from '~/components/ui/alert'

const predefinedTasks = [
  "Create a post announcing a new product launch",
  "Write a tweet about an upcoming event",
  "Craft an Instagram caption for a behind-the-scenes photo",
  "Compose a LinkedIn article about industry trends",
  "Generate a Facebook post for a holiday sale"
]

export default function AIAssistant() {
  const [platform, setPlatform] = useState('')
  const [task, setTask] = useState('')
  const [customTask, setCustomTask] = useState('')
  const [response, setResponse] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    setResponse('')
    try {
      // Simulating API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      if (Math.random() < 0.1) throw new Error("API error")
      const finalTask = task === 'custom' ? customTask : task
      setResponse(`Here's a suggested ${platform} post for the task: "${finalTask}"\n\nEngaging post: "🚀 Exciting news! We've just launched our new product line. 🎉 Check out our website for exclusive deals and be the first to experience innovation. #NewLaunch #ExcitingTimes #LimitedTimeOffer"`)
    } catch (err) {
      setError('An error occurred while processing your request. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(response)
    setCopied(true)
    toast({
      title: "Copied!",
      description: "The AI-generated content has been copied to your clipboard.",
    })
    setTimeout(() => setCopied(false), 2000)
  }

  const isFormValid = platform && (task || (task === 'custom' && customTask))

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate Social Media Content</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Select onValueChange={setPlatform} value={platform}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="facebook">Facebook</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="linkedin">LinkedIn</SelectItem>
              </SelectContent>
            </Select>
            <Select onValueChange={setTask} value={task}>
              <SelectTrigger>
                <SelectValue placeholder="Select task" />
              </SelectTrigger>
              <SelectContent>
                {predefinedTasks.map((t, index) => (
                  <SelectItem key={index} value={t}>{t}</SelectItem>
                ))}
                <SelectItem value="custom">Custom task</SelectItem>
              </SelectContent>
            </Select>
            {task === 'custom' && (
              <Input
                placeholder="Enter your custom task..."
                value={customTask}
                onChange={(e) => setCustomTask(e.target.value)}
                disabled={isLoading}
              />
            )}
            <Button type="submit" disabled={isLoading || !isFormValid}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating
                </>
              ) : (
                'Generate Content'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {response && (
        <Card>
          <CardHeader>
            <CardTitle className="flex justify-between items-center">
              Generated Content
              <Button variant="outline" size="sm" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={response}
              readOnly
              className="min-h-[200px]"
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}