// @ts-nocheck
import { useState } from 'react'
import { Button } from '~/components/ui/button'
import { Input } from '~/components/ui/input'
import { Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'

const formSchema = z.object({
  task: z.string().min(5, 'Task must be at least 5 characters long').max(200, 'Task must not exceed 200 characters')
})

// @ts-ignore
export default function AIInputForm({ onSubmit, isLoading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(formSchema)
  })

  const onSubmitForm = (/** @type {{ task: any; }} */ data) => {
    onSubmit(data.task)
  }

  return (
    <form onSubmit={handleSubmit(
// @ts-ignore
    onSubmitForm)} className="w-full">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-grow">
          <Input
            type="text"
            placeholder="Enter your social media task here..."
            {...register('task')}
            disabled={isLoading}
          />
          {errors.task && <p className="text-red-500 text-sm mt-1">{errors.task.message}</p>}
        </div>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Processing
            </>
          ) : (
            'Send to AI'
          )}
        </Button>
      </div>
    </form>
  )
}