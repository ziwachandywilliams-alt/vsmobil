'use client'

import { useRef, useEffect, useState } from 'react'
import { 
  Terminal, 
  Play, 
  Github,
  Trash2, 
  X,
  ChevronUp,
  ChevronDown,
  AlertCircle,
  CheckCircle,
  Info,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { useEditorStore } from '@/lib/store'
import { runCode } from '@/lib/code-runner'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

const getOutputIcon = (type: string) => {
  switch (type) {
    case 'error':
      return <AlertCircle className="w-3 h-3 text-destructive shrink-0" />
    case 'warn':
      return <AlertCircle className="w-3 h-3 text-yellow-500 shrink-0" />
    case 'info':
      return <Info className="w-3 h-3 text-blue-400 shrink-0" />
    case 'result':
      return <CheckCircle className="w-3 h-3 text-accent shrink-0" />
    default:
      return null
  }
}

export function TerminalPanel() {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const { 
    files,
    activeFileId,
    terminalOpen, 
    setTerminalOpen,
    consoleOutput, 
    addConsoleOutput, 
    clearConsole,
    setActivePanel,
    setSidebarOpen,
  } = useEditorStore()
  
  const activeFile = files.find(f => f.id === activeFileId)
  const hasPackageJson = files.some(f => f.path?.toLowerCase() === 'package.json' || f.name?.toLowerCase() === 'package.json')
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [consoleOutput])
  
  const handleRun = async () => {
    if (!activeFile) {
      addConsoleOutput({ type: 'error', content: 'Calistirilacak dosya secili degil' })
      return
    }
    
    addConsoleOutput({ 
      type: 'info', 
      content: `> ${activeFile.name} calistiriliyor...` 
    })
    
    const result = await runCode(activeFile.content, activeFile.language)
    
    result.output.forEach(line => {
      addConsoleOutput({ type: 'log', content: line })
    })
    
    result.errors.forEach(line => {
      addConsoleOutput({ type: 'error', content: line })
    })
    
    addConsoleOutput({ 
      type: result.success ? 'result' : 'error', 
      content: result.success 
        ? `Tamamlandi (${result.executionTime.toFixed(2)}ms)` 
        : `Hata ile sonlandi`
    })
  }

  const handleShowNextJsRunHelp = () => {
    if (!hasPackageJson) {
      addConsoleOutput({ type: 'warn', content: 'Bu projede package.json bulunamadi (Next.js/NPM proje degil gibi gorunuyor).' })
      return
    }
    addConsoleOutput({ type: 'info', content: 'Next.js / NPM Calistirma (PC terminalinde):' })
    addConsoleOutput({ type: 'log', content: 'npm install --no-audit --no-fund' })
    addConsoleOutput({ type: 'log', content: 'npm run dev' })
    addConsoleOutput({ type: 'info', content: 'Not: VSMobil icindeki onizleme, tam Node server calistiramaz. Buyuk projeler icin ZIP indirip PC’de calistirin.' })
  }

  const handleGoGitHub = () => {
    setActivePanel('git')
    setSidebarOpen(true)
  }
  
  const terminalHeight = expanded ? '50vh' : 180
  
  return (
    <AnimatePresence>
      {terminalOpen && (
        <motion.div
          initial={{ height: 0 }}
          animate={{ height: terminalHeight }}
          exit={{ height: 0 }}
          transition={{ duration: 0.2 }}
          className="border-t border-border bg-card overflow-hidden shrink-0"
        >
          <div className="flex items-center justify-between px-2 sm:px-3 py-2 bg-secondary/50 border-b border-border">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Konsol</span>
              {consoleOutput.length > 0 && (
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  {consoleOutput.length}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 touch-manipulation"
                onClick={handleRun}
                disabled={!activeFile}
                title="Calistir"
              >
                <Play className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 touch-manipulation"
                onClick={handleShowNextJsRunHelp}
                title="Next.js calistirma komutlari"
              >
                <Info className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 touch-manipulation"
                onClick={handleGoGitHub}
                title="GitHub"
              >
                <Github className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 touch-manipulation"
                onClick={clearConsole}
                title="Temizle"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 touch-manipulation"
                onClick={() => setExpanded(!expanded)}
                title={expanded ? 'Kucult' : 'Buyut'}
              >
                {expanded ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 touch-manipulation"
                onClick={() => setTerminalOpen(false)}
                title="Kapat"
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
          
          <div 
            ref={scrollRef}
            className="overflow-y-auto p-2 font-mono text-xs"
            style={{ height: `calc(${typeof terminalHeight === 'number' ? terminalHeight + 'px' : terminalHeight} - 44px)` }}
          >
            {consoleOutput.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <p>Calistirmak icin Play butonuna tiklayin</p>
              </div>
            ) : (
              <div className="space-y-1">
                {consoleOutput.map((output) => (
                  <div
                    key={output.id}
                    className={cn(
                      'flex items-start gap-2 px-2 py-1.5 rounded text-xs',
                      output.type === 'error' && 'bg-destructive/10 text-destructive',
                      output.type === 'warn' && 'bg-yellow-500/10 text-yellow-500',
                      output.type === 'info' && 'text-muted-foreground',
                      output.type === 'result' && 'bg-accent/10 text-accent',
                      output.type === 'log' && 'text-foreground'
                    )}
                  >
                    {getOutputIcon(output.type)}
                    <pre className="whitespace-pre-wrap break-all flex-1 leading-relaxed">
                      {output.content}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function TerminalToggle() {
  const { terminalOpen, setTerminalOpen, consoleOutput } = useEditorStore()
  
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 touch-manipulation"
      onClick={() => setTerminalOpen(!terminalOpen)}
    >
      <Terminal className="w-4 h-4" />
      <span className="text-xs hidden sm:inline">Konsol</span>
      {consoleOutput.length > 0 && (
        <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded">
          {consoleOutput.length}
        </span>
      )}
      {terminalOpen ? (
        <ChevronDown className="w-3 h-3" />
      ) : (
        <ChevronUp className="w-3 h-3" />
      )}
    </Button>
  )
}
