import Link from 'next/link'
import { Button } from "~/components/ui/button"
import { MoonIcon, SunIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export default function Header() {
  const { theme, setTheme } = useTheme()

  const useHasMounted = () => {
    const [hasMounted, setHasMounted] = useState(false)
  
    useEffect(() => {
      setHasMounted(true)
    }, [])
  
    return hasMounted
  }
  

  return (
    <header className="py-4 px-4 sm:px-6 lg:px-8 bg-white dark:bg-gray-800 shadow-md">
      <div className="container mx-auto flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/">
            <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">AI Copilot</span>
          </Link>
        </div>
        <nav className="hidden md:block">
          <ul className="flex space-x-6">
            <li><Link href="/" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Home</Link></li>
            <li><Link href="/ai-assistant" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">AI Assistant</Link></li>
            <li><Link href="/quality-analysis" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Quality Analysis</Link></li>
            <li><Link href="/pricing" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Pricing</Link></li>
            <li><a href="#features" className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Features</a></li>
          </ul>
        </nav>
        <div className="flex items-center space-x-4">
          {useHasMounted() && <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
            {theme === 'dark' ? <SunIcon className="h-5 w-5" /> : <MoonIcon className="h-5 w-5" />}
          </Button>}
          <Link href="/sign-in"><Button>Sign In</Button></Link>
        </div>
      </div>
    </header>
  )
}