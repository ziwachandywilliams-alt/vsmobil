'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { 
  X, 
  Maximize2, 
  Minimize2, 
  RefreshCw, 
  ExternalLink,
  Smartphone,
  Monitor,
  Tablet
} from 'lucide-react'
import { useEditorStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'

type DeviceSize = 'mobile' | 'tablet' | 'desktop'

const deviceSizes: Record<DeviceSize, { width: string; label: string }> = {
  mobile: { width: '375px', label: 'Mobil' },
  tablet: { width: '768px', label: 'Tablet' },
  desktop: { width: '100%', label: 'Masaustu' },
}

export function PreviewPanel() {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [device, setDevice] = useState<DeviceSize>('desktop')
  const [refreshKey, setRefreshKey] = useState(0)
  const [route, setRoute] = useState<{ search: string; hash: string }>({ search: '', hash: '' })
  
  const {
    files,
    activeFileId,
    previewOpen,
    previewFullscreen,
    setPreviewOpen,
    setPreviewFullscreen,
    navigateToPath,
    addConsoleOutput,
  } = useEditorStore()
  
  const activeFile = files.find(f => f.id === activeFileId)
  const activePath = activeFile?.path || activeFile?.name || ''

  useEffect(() => {
    setRoute({ search: '', hash: '' })
  }, [activeFileId])

  const resolveRelativePath = useCallback((fromPath: string, href: string) => {
    const cleanHref = (href || '').trim()
    if (!cleanHref) return ''

    // Remove hash/query for file lookup
    const hrefNoHash = cleanHref.split('#')[0].split('?')[0]
    if (!hrefNoHash) return ''

    // Absolute-ish project path
    if (hrefNoHash.startsWith('/')) return hrefNoHash.replace(/^\/+/, '')

    // Build a fake base URL to leverage URL resolution
    const from = fromPath.replace(/\\/g, '/').replace(/^\/+/, '')
    const baseDir = from.includes('/') ? from.slice(0, from.lastIndexOf('/') + 1) : ''
    const base = new URL(`https://vsmobil.local/${baseDir}`)
    const resolved = new URL(hrefNoHash, base)
    return resolved.pathname.replace(/^\/+/, '')
  }, [])

  const parseRoute = useCallback((href: string) => {
    const h = (href || '').trim()
    const hashIdx = h.indexOf('#')
    const queryIdx = h.indexOf('?')
    const hash = hashIdx !== -1 ? h.slice(hashIdx) : ''
    const search = queryIdx !== -1 ? h.slice(queryIdx, hashIdx !== -1 ? hashIdx : undefined) : ''
    return { search, hash }
  }, [])
  
  // Build the HTML content with all project files
  const buildPreviewContent = useCallback(() => {
    if (!activeFile) return ''
    
    // Find all CSS files
    const cssFiles = files.filter(f => f.language === 'css' || f.language === 'scss')
    const cssContent = cssFiles.map(f => f.content).join('\n')
    
    // Find all JS files
    const jsFiles = files.filter(f => f.language === 'javascript' || f.language === 'typescript')
    const jsContent = jsFiles.map(f => f.content).join('\n')
    
    let htmlContent = activeFile.content
    
    // If active file is HTML, inject CSS and JS
    if (activeFile.language === 'html') {
      // Add collected CSS before </head>
      if (cssContent && !htmlContent.includes(cssContent)) {
        const cssInjection = `<style>\n${cssContent}\n</style>\n</head>`
        htmlContent = htmlContent.replace('</head>', cssInjection)
      }
      
      // Handle internal links - intercept and navigate
      const linkHandler = `
        <script>
          // Expose a lightweight "route" object for multi-page previews.
          // Note: srcDoc pages don't have a real URL, so use this instead of window.location.
          window.__VSMOBIL_ROUTE = ${JSON.stringify({ path: activePath, ...route })};

          function __vsmobil_isInternalHref(href) {
            if (!href) return false;
            if (href.startsWith('http') || href.startsWith('//') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
            return true;
          }

          function __vsmobil_sendAssetRequest(tag, attr, rawHref) {
            if (!rawHref) return;
            if (!__vsmobil_isInternalHref(rawHref)) return;
            window.parent.postMessage({ type: 'assetRequest', from: window.__VSMOBIL_ROUTE?.path || '', href: rawHref, tag, attr }, '*');
          }

          // Replace relative asset refs (img/src, source/src, video/poster) by asking parent for data-url
          function __vsmobil_scanAssets(root) {
            if (!root) return;
            const nodes = root.querySelectorAll('img[src], source[src], video[poster]');
            nodes.forEach(el => {
              if (el.__vsmobil_assetBound) return;
              el.__vsmobil_assetBound = true;
              const attr = el.tagName.toLowerCase() === 'video' ? 'poster' : 'src';
              const href = el.getAttribute(attr);
              __vsmobil_sendAssetRequest(el.tagName.toLowerCase(), attr, href);
            });
          }

          // Observe DOM changes for dynamically added images
          const __vsmobil_observer = new MutationObserver((mutations) => {
            for (const m of mutations) {
              if (m.type === 'childList') {
                m.addedNodes && m.addedNodes.forEach(n => {
                  if (n && n.querySelectorAll) __vsmobil_scanAssets(n);
                });
              }
            }
          });
          __vsmobil_observer.observe(document.documentElement, { childList: true, subtree: true });
          document.addEventListener('DOMContentLoaded', () => __vsmobil_scanAssets(document));

          // Receive asset responses from parent
          window.addEventListener('message', (e) => {
            if (!e.data || e.data.type !== 'assetResponse') return;
            const { href, dataUrl } = e.data;
            if (!href || !dataUrl) return;
            // Update elements that still have this href
            const selectors = [
              'img[src="' + href.replace(/"/g, '\\"') + '"]',
              'source[src="' + href.replace(/"/g, '\\"') + '"]',
              'video[poster="' + href.replace(/"/g, '\\"') + '"]'
            ];
            document.querySelectorAll(selectors.join(',')).forEach(el => {
              const attr = el.tagName.toLowerCase() === 'video' ? 'poster' : 'src';
              el.setAttribute(attr, dataUrl);
            });
          });
          // Intercept link clicks
          document.addEventListener('click', function(e) {
            const link = e.target.closest('a');
            if (link && link.href) {
              const href = link.getAttribute('href');
              if (__vsmobil_isInternalHref(href)) {
                e.preventDefault();
                // Send message to parent
                window.parent.postMessage({ type: 'navigate', file: href }, '*');
              }
            }
          });
          
          // Intercept form submissions
          document.addEventListener('submit', function(e) {
            const form = e.target;
            const action = form.getAttribute('action');
            if (__vsmobil_isInternalHref(action)) {
              e.preventDefault();
              const formData = new FormData(form);
              const data = Object.fromEntries(formData.entries());
              window.parent.postMessage({ type: 'formSubmit', action, data }, '*');
            }
          });
          
          // Override console.log to send to parent
          const originalConsole = { ...console };
          ['log', 'error', 'warn', 'info'].forEach(method => {
            console[method] = function(...args) {
              originalConsole[method].apply(console, args);
              window.parent.postMessage({ 
                type: 'console', 
                method, 
                args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))
              }, '*');
            };
          });
        </script>
      `
      
      // Add JS before </body>
      if (jsContent) {
        const jsInjection = `<script>\n${jsContent}\n</script>\n${linkHandler}\n</body>`
        htmlContent = htmlContent.replace('</body>', jsInjection)
      } else {
        htmlContent = htmlContent.replace('</body>', `${linkHandler}\n</body>`)
      }
      
      return htmlContent
    }
    
    // For CSS files, create a simple preview
    if (activeFile.language === 'css') {
      return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CSS Onizleme</title>
  <style>${activeFile.content}</style>
</head>
<body>
  <div class="container">
    <h1>CSS Onizleme</h1>
    <p>Bu sayfada CSS stillerinizi gorebilirsiniz.</p>
    <button>Ornek Buton</button>
    <input type="text" placeholder="Ornek Input">
    <div class="box">Ornek Kutu</div>
  </div>
</body>
</html>`
    }
    
    return ''
  }, [activeFile, files, activePath, route])
  
  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.data.type === 'navigate') {
        const href = String(e.data.file || '')
        const targetPath = resolveRelativePath(activePath, href)
        if (targetPath) {
          setRoute(parseRoute(href))
          navigateToPath(targetPath)
          addConsoleOutput({ type: 'info', content: `Navigasyon: ${targetPath}` })
        } else {
          addConsoleOutput({ type: 'warn', content: `Navigasyon cozulemedi: ${href}` })
        }
      } else if (e.data.type === 'console') {
        addConsoleOutput({ 
          type: e.data.method === 'error' ? 'error' : e.data.method === 'warn' ? 'warn' : 'log',
          content: e.data.args.join(' ')
        })
      } else if (e.data.type === 'formSubmit') {
        addConsoleOutput({ 
          type: 'info', 
          content: `Form gonderildi: ${e.data.action}\nVeri: ${JSON.stringify(e.data.data, null, 2)}`
        })
      } else if (e.data.type === 'assetRequest') {
        const href = String(e.data.href || '')
        const from = String(e.data.from || activePath)
        const targetPath = resolveRelativePath(from, href)
        const file = targetPath ? files.find(f => (f.path || '').replace(/\\/g, '/') === targetPath) : undefined
        const dataUrl = file?.content && file.content.startsWith('data:') ? file.content : null
        if (dataUrl) {
          ;(iframeRef.current?.contentWindow || window).postMessage({ type: 'assetResponse', href, dataUrl }, '*')
        } else {
          // silent fail; assets might be missing
        }
      }
    }
    
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [navigateToPath, addConsoleOutput, resolveRelativePath, activePath, parseRoute, files])
  
  const handleRefresh = () => {
    setRefreshKey(k => k + 1)
  }
  
  const handleOpenExternal = () => {
    const content = buildPreviewContent()
    const blob = new Blob([content], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }
  
  const canPreview = activeFile && (activeFile.language === 'html' || activeFile.language === 'css')
  
  if (!previewOpen || !canPreview) return null
  
  const previewContent = buildPreviewContent()
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 100 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 100 }}
        className={cn(
          'bg-card border-l border-border flex flex-col',
          previewFullscreen 
            ? 'fixed inset-0 z-50' 
            : 'w-full md:w-1/2 lg:w-2/5'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Onizleme</span>
            <span className="text-xs text-muted-foreground">
              {activeFile?.name}
            </span>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Device toggles */}
            <div className="hidden sm:flex items-center gap-0.5 mr-2 bg-secondary rounded-md p-0.5">
              <Button
                variant={device === 'mobile' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-6 w-6"
                onClick={() => setDevice('mobile')}
                title="Mobil"
              >
                <Smartphone className="w-3 h-3" />
              </Button>
              <Button
                variant={device === 'tablet' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-6 w-6"
                onClick={() => setDevice('tablet')}
                title="Tablet"
              >
                <Tablet className="w-3 h-3" />
              </Button>
              <Button
                variant={device === 'desktop' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-6 w-6"
                onClick={() => setDevice('desktop')}
                title="Masaustu"
              >
                <Monitor className="w-3 h-3" />
              </Button>
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleRefresh}
              title="Yenile"
            >
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={handleOpenExternal}
              title="Yeni sekmede ac"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPreviewFullscreen(!previewFullscreen)}
              title={previewFullscreen ? 'Kucult' : 'Tam Ekran'}
            >
              {previewFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPreviewOpen(false)}
              title="Kapat"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
        
        {/* Preview iframe */}
        <div className="flex-1 bg-white overflow-auto flex items-start justify-center p-2">
          <div 
            className={cn(
              'h-full bg-white shadow-lg transition-all duration-300',
              device !== 'desktop' && 'border border-gray-200 rounded-lg overflow-hidden'
            )}
            style={{ 
              width: deviceSizes[device].width,
              maxWidth: '100%'
            }}
          >
            <iframe
              key={refreshKey}
              ref={iframeRef}
              srcDoc={previewContent}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-forms allow-modals"
              title="Preview"
            />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
