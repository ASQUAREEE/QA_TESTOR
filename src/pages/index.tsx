import Head from "next/head";
import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import dynamic from 'next/dynamic';
import { Laptop, Users, TrendingUp, Zap, ArrowUp } from 'lucide-react';

import { api } from "~/utils/api";
import { Button } from "~/components/ui/button";
import AIInputForm from "~/components/AIInputForm";
import AIResponse from "~/components/AIResponse";
import Header from "~/components/Header";
import Footer from "~/components/Footer";
import DataVisualization from "~/components/DataVisualization";

const DynamicTestimonials = dynamic(() => import('~/components/Testimonials'), { ssr: false });
const DynamicFAQ = dynamic(() => import('~/components/FAQ'), { ssr: false });

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
        <title>AI Copilot - Your Intelligent Social Media Assistant</title>
        <meta name="description" content="AI-powered social media management tool to supercharge your online presence. Automate posting, analyze engagement, and create content with ease." />
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
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600 z-0"></div>
            <div className="absolute inset-0 bg-grid-pattern opacity-10 z-10"></div>
            <div className="relative z-20">
              <h1 className="text-4xl sm:text-6xl font-bold mb-4">
                Social Media AI Copilot
              </h1>
              <p className="text-xl sm:text-2xl mb-8">
                Let AI manage your social media accounts
              </p>
              <Button size="lg" variant="secondary">Get Started Now</Button>
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
              <motion.div whileHover={{ scale: 1.05 }} className="feature-card">
                <Laptop className="w-12 h-12 mb-4 text-blue-500" />
                <h3 className="text-xl font-semibold mb-2">Automated Scheduling</h3>
                <p>Optimize your posting times for maximum engagement</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className="feature-card">
                <Users className="w-12 h-12 mb-4 text-green-500" />
                <h3 className="text-xl font-semibold mb-2">Audience Insights</h3>
                <p>Understand your followers better with AI-driven analytics</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className="feature-card">
                <TrendingUp className="w-12 h-12 mb-4 text-purple-500" />
                <h3 className="text-xl font-semibold mb-2">Trend Monitoring</h3>
                <p>Stay ahead of the curve with real-time trend analysis</p>
              </motion.div>
              <motion.div whileHover={{ scale: 1.05 }} className="feature-card">
                <Zap className="w-12 h-12 mb-4 text-yellow-500" />
                <h3 className="text-xl font-semibold mb-2">Content Creation</h3>
                <p>Generate engaging posts with AI assistance</p>
              </motion.div>
            </div>
          </motion.div>

          {/* AI demo section */}
          <div className="ai-demo-section py-16 px-4 sm:px-6 lg:px-8 bg-gray-100 dark:bg-gray-800">
            <h2 className="text-3xl font-semibold mb-8 text-center">Try It Out</h2>
            <div className="max-w-2xl mx-auto">
              <AIInputForm onSubmit={handleAISubmit} isLoading={isLoading} />
              {error && <p className="text-red-500 mt-4">{error}</p>}
              {aiResponse && <AIResponse response={aiResponse} />}
            </div>
          </div>

          {/* Data visualization section */}
          <div className="data-viz-section py-16 px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-semibold mb-8 text-center">Engagement Analytics</h2>
            <DataVisualization />
          </div>

          <DynamicTestimonials />

          <DynamicFAQ />

          {/* CTA section */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4, duration: 0.5 }}
            className="cta-section text-center py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-purple-600 to-blue-500 text-white"
          >
            <h2 className="text-3xl font-semibold mb-4">Ready to supercharge your social media?</h2>
            <p className="text-xl mb-8">Join thousands of satisfied users and take your social presence to the next level.</p>
            <Button size="lg" variant="secondary">Get Started Now</Button>
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