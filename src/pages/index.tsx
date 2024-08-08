import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from 'next/dynamic';
import { Laptop, Users, TrendingUp, Zap, ArrowUp } from 'lucide-react';

import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import Header from "~/components/Header";
import Footer from "~/components/Footer";

export default function Home() {
  const [aiResponse, setAiResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showScrollTop, setShowScrollTop] = useState(false);

  // const hello = api.post.hello.useQuery({ text: "from tRPC" });

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.pageYOffset > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleAISubmit = async (task: string) => {
    setIsLoading(true);
    setError(null);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      const responses = [
        `I'll help you with your task: "${task}". Here's what I'm going to do:
        1. Analyze the content of your request
        2. Generate appropriate hashtags
        3. Schedule the post for optimal engagement time
        4. Monitor initial responses and engagement`,
        `Certainly! For your task: "${task}", I'll take the following steps:
        1. Research trending topics related to your content
        2. Draft a compelling post with attention-grabbing headlines
        3. Create a custom image using AI-generated graphics
        4. Set up automated responses for common questions`,
        `Got it! To handle "${task}", here's my plan:
        1. Conduct sentiment analysis on your target audience
        2. Craft a series of posts to be published over the next week
        3. Identify and engage with key influencers in your niche
        4. Provide daily engagement reports and recommendations`
      ];
      const randomResponse = responses[Math.floor(Math.random() * responses.length)];
      if (randomResponse) {
        setAiResponse(randomResponse);
      } else {
        setError("Failed to generate a response. Please try again.");
      }
    } catch (err) {
      setError("An error occurred while processing your request. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <Head>
        <title>WebExplorer AI - Your Intelligent Web Browsing Assistant</title>
        <meta name="description" content="AI-powered web browsing assistant to enhance your online experience. Discover content, analyze websites, and navigate the web with ease." />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="flex flex-col min-h-screen">
        <Header />
        <main className="flex-grow">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="hero-section text-center py-20 px-4 sm:px-6 lg:px-8 text-white relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-blue-600 z-0"></div>
            <div className="absolute inset-0 bg-[url('/circuit-board.svg')] opacity-10 z-10"></div>
            <div className="relative z-20">
              <h1 className="text-4xl sm:text-6xl font-bold mb-4">
                WebExplorer AI
              </h1>
              <p className="text-xl sm:text-2xl mb-8">
                Your intelligent companion for web browsing
              </p>
              <Button size="lg" variant="secondary">Start Exploring</Button>
            </div>
          </motion.div>

          {/* Features section */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="features-section py-16 px-4 sm:px-6 lg:px-8"
          >
            <h2 className="text-3xl font-semibold mb-8 text-center">Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              <motion.div whileHover={{ scale: 1.05 }} className="feature-card p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <Laptop className="w-12 h-12 mb-4 text-cyan-500" />
                <h3 className="text-xl font-semibold mb-2">Smart Search</h3>
                <p>Find exactly what you're looking for with AI-powered search</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className="feature-card p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <Users className="w-12 h-12 mb-4 text-blue-500" />
                <h3 className="text-xl font-semibold mb-2">Content Curation</h3>
                <p>Discover personalized content tailored to your interests</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className="feature-card p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <TrendingUp className="w-12 h-12 mb-4 text-indigo-500" />
                <h3 className="text-xl font-semibold mb-2">Web Analysis</h3>
                <p>Get instant insights and summaries of web pages</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className="feature-card p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
                <Zap className="w-12 h-12 mb-4 text-yellow-500" />
                <h3 className="text-xl font-semibold mb-2">Task Automation</h3>
                <p>Automate repetitive browsing tasks with ease</p>
              </motion.div>
            </div>
          </motion.div>

          {/* AI demo section */}

          {/* CTA section */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="cta-section text-center py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-blue-600 to-cyan-500 text-white"
          >
            <h2 className="text-3xl font-semibold mb-4">Ready to revolutionize your web browsing?</h2>
            <p className="text-xl mb-8">Join thousands of users and experience the web like never before.</p>
            <Button size="lg" variant="secondary">Get WebExplorer AI Now</Button>
          </motion.div>
        </main>
        <Footer />
        <AnimatePresence>
          {showScrollTop && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={scrollToTop}
              className="scroll-to-top"
              aria-label="Scroll to top"
            >
              <ArrowUp />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </>
  );
}