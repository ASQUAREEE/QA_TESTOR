import Head from 'next/head'
import Header from '~/components/Header'
import Footer from '~/components/Footer'
import { Card, CardContent } from '~/components/ui/card'
import { Input } from '~/components/ui/input'
import { Button } from '~/components/ui/button'
import { Textarea } from '~/components/ui/textarea'
import { useState } from 'react'
import { api } from '~/utils/api'

export default function AIAssistantPage() {
  const [task, setTask] = useState('')
  const [times, setTimes] = useState(1)
  const [result, setResult] = useState('')
  const [livePageUrl, setLivePageUrl] = useState('')
  const [error, setError] = useState('')

  const {mutateAsync: executeTask} = api.ai.executeTask.useMutation()

  const handleSubmit = async () => {
    setError('')
    if (!task) {
      setError('Please enter a task')
      return
    }
    try {
      // @ts-ignore
      const response = await executeTask({ task, times })
      setResult(response.result)
      setLivePageUrl(response.livePageUrl)
    } catch (err) {
      // @ts-ignore
      setError(err.message || 'An error occurred')
    }
  }

  return (
    <>
      <Head>
        <title>AI Assistant - AI Copilot</title>
        <meta name="description" content="Interact with our AI assistant for various tasks and content creation." />
      </Head>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow container mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold mb-6">AI Assistant</h1>
          <Card className="mb-8">
            <CardContent className="space-y-4">
              <Textarea 
                placeholder="Enter your task here (e.g., 'Search for the latest news about AI')" 
                value={task} 
                onChange={(e) => setTask(e.target.value)}
              />
              <Input 
                type="number" 
                placeholder="Number of times to repeat task" 
                value={times} 
                onChange={(e) => setTimes(parseInt(e.target.value))}
              />
              <Button onClick={handleSubmit}>Execute Task</Button>
              {error && <p className="text-red-500">{error}</p>}
            </CardContent>
          </Card>
          {result && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Result</h2>
              <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap">{result}</pre>
            </div>
          )}
          {livePageUrl && (
            <div className="mt-8">
              <h2 className="text-xl font-semibold mb-4">Live Page</h2>
              <iframe src={livePageUrl} width="100%" height="600" frameBorder="0"></iframe>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </>
  )
}