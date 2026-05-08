'use client'

import { useState, useEffect } from 'react'
import { 
  Github, 
  GitBranch, 
  ExternalLink,
  LogOut,
  RefreshCw,
  FolderGit2,
  Download,
  FileCode,
  Folder,
  ArrowLeft,
  Loader2,
  FolderDown,
  Upload,
  Package,
  Search
} from 'lucide-react'
import { useEditorStore, GitHubFile } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'

// Binary assets we DO want (up to a size limit)
const ASSET_EXTENSIONS = [
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp', '.bmp',
  '.woff', '.woff2', '.ttf', '.eot',
]

// File extensions to skip (binary/large files)
const SKIP_EXTENSIONS = [
  '.mp3', '.mp4', '.wav', '.ogg', '.webm', '.avi', '.mov',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.exe', '.dll', '.so', '.dylib',
  '.lock', '.lockb'
]

const MAX_ASSET_BYTES = 2 * 1024 * 1024 // 2MB

// Folders to skip
const SKIP_FOLDERS = ['node_modules', '.git', 'dist', 'build', '.next', 'vendor', '__pycache__']

function shouldSkipFile(path: string): boolean {
  const lowerPath = path.toLowerCase()
  
  // Check folders
  for (const folder of SKIP_FOLDERS) {
    if (lowerPath.includes(`/${folder}/`) || lowerPath.startsWith(`${folder}/`)) {
      return true
    }
  }
  
  // Check extensions
  for (const ext of SKIP_EXTENSIONS) {
    if (lowerPath.endsWith(ext)) {
      return true
    }
  }
  
  return false
}

function isAssetPath(path: string): boolean {
  const p = path.toLowerCase()
  return ASSET_EXTENSIONS.some(ext => p.endsWith(ext))
}

function guessMimeType(path: string): string {
  const p = path.toLowerCase()
  if (p.endsWith('.png')) return 'image/png'
  if (p.endsWith('.jpg') || p.endsWith('.jpeg')) return 'image/jpeg'
  if (p.endsWith('.gif')) return 'image/gif'
  if (p.endsWith('.webp')) return 'image/webp'
  if (p.endsWith('.bmp')) return 'image/bmp'
  if (p.endsWith('.ico')) return 'image/x-icon'
  if (p.endsWith('.svg')) return 'image/svg+xml'
  if (p.endsWith('.woff')) return 'font/woff'
  if (p.endsWith('.woff2')) return 'font/woff2'
  if (p.endsWith('.ttf')) return 'font/ttf'
  if (p.endsWith('.eot')) return 'application/vnd.ms-fontobject'
  return 'application/octet-stream'
}

async function toDataUrlFromResponse(res: Response, mime: string): Promise<string> {
  const blob = await res.blob()
  return await new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Dosya okunamadi'))
    reader.onload = () => resolve(String(reader.result))
    reader.readAsDataURL(new Blob([blob], { type: mime }))
  })
}

export function GitHubPanel() {
  const { 
    githubToken, 
    githubUser, 
    repos, 
    currentRepo,
    currentRepoFiles,
    currentPath,
    loadingGithub,
    downloadProgress,
    setGitHubToken, 
    setGitHubUser, 
    setRepos,
    setCurrentRepo,
    setCurrentRepoFiles,
    setCurrentPath,
    setLoadingGithub,
    setDownloadProgress,
    importFiles,
    loadProjectFromGitHub,
    pushCurrentProjectToGitHub,
    pushLinkedProjectToGitHub,
    files,
    projects,
    currentProjectId,
    addConsoleOutput,
    setTerminalOpen,
    setActivePanel,
  } = useEditorStore()
  
  const [tokenDialog, setTokenDialog] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [error, setError] = useState('')
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [uploadDialog, setUploadDialog] = useState(false)
  const [uploadBranch, setUploadBranch] = useState('')
  const [uploadMessage, setUploadMessage] = useState('')
  const [uploading, setUploading] = useState(false)
  const [linkedUploadDialog, setLinkedUploadDialog] = useState(false)
  const [linkedBranch, setLinkedBranch] = useState('')
  const [linkedMessage, setLinkedMessage] = useState('')
  const [linkedUploading, setLinkedUploading] = useState(false)

  const linkedRepo = currentProjectId
    ? projects.find(p => p.id === currentProjectId)?.githubRepo || null
    : null
  
  const filteredRepos = repos.filter(repo => 
    repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )
  
  const connectGitHub = async () => {
    if (!tokenInput.trim()) return
    
    setLoadingGithub(true)
    setError('')
    
    try {
      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenInput}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })
      
      if (!userRes.ok) {
        throw new Error('Gecersiz token')
      }
      
      const userData = await userRes.json()
      
      const reposRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          Authorization: `Bearer ${tokenInput}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })
      
      if (!reposRes.ok) {
        throw new Error('Repolar alinamadi')
      }
      
      const reposData = await reposRes.json()
      
      setGitHubToken(tokenInput)
      setGitHubUser(userData.login)
      setRepos(reposData.map((repo: Record<string, unknown>) => ({
        id: repo.id,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        url: repo.html_url,
        defaultBranch: repo.default_branch,
      })))
      
      setTokenDialog(false)
      setTokenInput('')
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata olustu')
    } finally {
      setLoadingGithub(false)
    }
  }
  
  const disconnect = () => {
    setGitHubToken(null)
    setGitHubUser(null)
    setRepos([])
    setCurrentRepo(null)
    setCurrentRepoFiles([])
    setCurrentPath('')
  }
  
  const refreshRepos = async () => {
    if (!githubToken) return
    
    setLoadingGithub(true)
    try {
      const reposRes = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })
      
      if (reposRes.ok) {
        const reposData = await reposRes.json()
        setRepos(reposData.map((repo: Record<string, unknown>) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || '',
          url: repo.html_url,
          defaultBranch: repo.default_branch,
        })))
      }
    } finally {
      setLoadingGithub(false)
    }
  }
  
  const loadRepoContents = async (path: string = '') => {
    if (!githubToken || !currentRepo) return
    
    setLoadingGithub(true)
    try {
      const url = path 
        ? `https://api.github.com/repos/${currentRepo.fullName}/contents/${path}`
        : `https://api.github.com/repos/${currentRepo.fullName}/contents`
      
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })
      
      if (res.ok) {
        const data = await res.json()
        const files: GitHubFile[] = (Array.isArray(data) ? data : [data]).map((item: Record<string, unknown>) => ({
          name: item.name as string,
          path: item.path as string,
          type: item.type as 'file' | 'dir',
          size: item.size as number | undefined,
          sha: item.sha as string,
          download_url: item.download_url as string | undefined,
        }))
        
        // Sort: directories first, then files
        files.sort((a, b) => {
          if (a.type === b.type) return a.name.localeCompare(b.name)
          return a.type === 'dir' ? -1 : 1
        })
        
        setCurrentRepoFiles(files)
        setCurrentPath(path)
      }
    } finally {
      setLoadingGithub(false)
    }
  }
  
  const downloadFile = async (file: GitHubFile) => {
    if (!file.download_url || !githubToken) return
    
    setDownloadingFiles(prev => new Set([...prev, file.path]))
    
    try {
      const res = await fetch(file.download_url)
      if (res.ok) {
        const isAsset = isAssetPath(file.path)
        const content = isAsset
          ? await toDataUrlFromResponse(res, guessMimeType(file.path))
          : await res.text()

        importFiles([{ name: file.name, content, path: file.path }])
        
        setTerminalOpen(true)
        addConsoleOutput({ 
          type: 'info', 
          content: `Dosya indirildi: ${file.name}` 
        })
      }
    } catch (err) {
      addConsoleOutput({ 
        type: 'error', 
        content: `Dosya indirilemedi: ${file.name}` 
      })
    } finally {
      setDownloadingFiles(prev => {
        const next = new Set(prev)
        next.delete(file.path)
        return next
      })
    }
  }
  
  // Recursively get all files from a repo
  const getAllFilesRecursive = async (
    repoFullName: string, 
    path: string = ''
  ): Promise<{ name: string; content: string; path: string }[]> => {
    const url = path 
      ? `https://api.github.com/repos/${repoFullName}/contents/${path}`
      : `https://api.github.com/repos/${repoFullName}/contents`
    
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github.v3+json',
      },
    })
    
    if (!res.ok) return []
    
    const items = await res.json()
    const allFiles: { name: string; content: string; path: string }[] = []
    
    for (const item of (Array.isArray(items) ? items : [items])) {
      // Skip unwanted files/folders
      if (shouldSkipFile(item.path)) continue
      
      if (item.type === 'dir') {
        // Skip certain directories
        if (SKIP_FOLDERS.includes(item.name)) continue
        
        // Recursively get files from subdirectory
        const subFiles = await getAllFilesRecursive(repoFullName, item.path)
        allFiles.push(...subFiles)
      } else if (item.type === 'file' && item.download_url) {
        const isAsset = isAssetPath(item.path)
        if (isAsset && typeof item.size === 'number' && item.size > MAX_ASSET_BYTES) {
          continue
        }
        try {
          const fileRes = await fetch(item.download_url)
          if (fileRes.ok) {
            const content = isAsset
              ? await toDataUrlFromResponse(fileRes, guessMimeType(item.path))
              : await fileRes.text()
            allFiles.push({
              name: item.name,
              content,
              path: item.path,
            })
            
            // Update progress
            setDownloadProgress(prev => prev ? {
              ...prev,
              current: prev.current + 1
            } : null)
          }
        } catch {
          // Skip failed files
        }
      }
    }
    
    return allFiles
  }
  
  // Download entire repo and create project
  const downloadEntireRepo = async () => {
    if (!githubToken || !currentRepo) return
    
    setLoadingGithub(true)
    setTerminalOpen(true)
    addConsoleOutput({ 
      type: 'info', 
      content: `Tum proje indiriliyor: ${currentRepo.name}...` 
    })
    addConsoleOutput({ 
      type: 'info', 
      content: `Not: node_modules, .git gibi buyuk klasorler atlanacak.` 
    })
    
    // First, count total files (approximate)
    setDownloadProgress({ current: 0, total: -1 })
    
    try {
      const allFiles = await getAllFilesRecursive(currentRepo.fullName)
      
      if (allFiles.length > 0) {
        // Create project with all files
        loadProjectFromGitHub(currentRepo, allFiles)
        
        addConsoleOutput({ 
          type: 'result', 
          content: `Basarili! ${allFiles.length} dosya indirildi ve proje olusturuldu.` 
        })
        
        // Switch to explorer panel
        setActivePanel('explorer')
      } else {
        addConsoleOutput({ 
          type: 'error', 
          content: 'Indirilecek dosya bulunamadi.' 
        })
      }
    } catch (err) {
      addConsoleOutput({ 
        type: 'error', 
        content: `Hata: ${err instanceof Error ? err.message : 'Bilinmeyen hata'}` 
      })
    } finally {
      setLoadingGithub(false)
      setDownloadProgress(null)
    }
  }

  const downloadRepoZip = async () => {
    if (!githubToken || !currentRepo) return
    setTerminalOpen(true)
    addConsoleOutput({ type: 'info', content: `ZIP indiriliyor: ${currentRepo.fullName}` })
    try {
      const res = await fetch(`https://api.github.com/repos/${currentRepo.fullName}/zipball/${currentRepo.defaultBranch}`, {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })
      if (!res.ok) throw new Error(`ZIP indirilemedi (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${currentRepo.name}.zip`
      a.click()
      URL.revokeObjectURL(url)
      addConsoleOutput({ type: 'result', content: 'ZIP indirildi. PC’de acip tam projeyi calistirabilirsiniz.' })
    } catch (e) {
      addConsoleOutput({ type: 'error', content: `ZIP indirilemedi: ${e instanceof Error ? e.message : 'Bilinmeyen hata'}` })
    }
  }
  
  const goBack = () => {
    const parts = currentPath.split('/')
    parts.pop()
    loadRepoContents(parts.join('/'))
  }
  
  useEffect(() => {
    if (currentRepo && !currentRepoFiles.length) {
      loadRepoContents()
    }
  }, [currentRepo])
  
  if (!githubToken) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 p-3 border-b border-border">
          <Github className="w-4 h-4" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            GitHub
          </span>
        </div>
        
        <div className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <Github className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="font-medium mb-2">GitHub&apos;a Baglan</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Repolariniza erismek icin GitHub hesabinizi baglayin
          </p>
          <Button onClick={() => setTokenDialog(true)}>
            <Github className="w-4 h-4 mr-2" />
            Baglan
          </Button>
        </div>
        
        <Dialog open={tokenDialog} onOpenChange={setTokenDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>GitHub Token</DialogTitle>
              <DialogDescription>
                GitHub Personal Access Token girin. Token repo okuma yetkisine sahip olmalidir.
              </DialogDescription>
            </DialogHeader>
            <Input
              type="password"
              placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && connectGitHub()}
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setTokenDialog(false)}>
                Iptal
              </Button>
              <Button onClick={connectGitHub} disabled={loadingGithub}>
                {loadingGithub ? 'Baglaniyor...' : 'Baglan'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
  
  // Repo selected - show files
  if (currentRepo) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between p-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setCurrentRepo(null)}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <span className="text-xs font-medium truncate max-w-[120px]">
              {currentRepo.name}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => loadRepoContents(currentPath)}
              disabled={loadingGithub}
            >
              <RefreshCw className={cn('w-3 h-3', loadingGithub && 'animate-spin')} />
            </Button>
          </div>
        </div>
        
        {/* Download / Upload actions */}
        <div className="p-2 border-b border-border space-y-2">
          <Button
            className="w-full gap-2"
            onClick={downloadEntireRepo}
            disabled={loadingGithub}
          >
            {loadingGithub ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {downloadProgress && downloadProgress.current > 0 
                  ? `${downloadProgress.current} dosya...`
                  : 'Indiriliyor...'
                }
              </>
            ) : (
              <>
                <FolderDown className="w-4 h-4" />
                Tum Projeyi Indir
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={() => setUploadDialog(true)}
            disabled={loadingGithub || uploading || files.length === 0}
            title={files.length === 0 ? 'Once dosya/proje olusturun' : 'Mevcut dosyalari bu repoya yukle'}
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Yukleniyor...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Projeyi Bu Repoya Yukle
              </>
            )}
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={downloadRepoZip}
            disabled={loadingGithub}
            title="Buyuk projeler icin: ZIP indir"
          >
            <Package className="w-4 h-4" />
            Repoyu ZIP Olarak Indir
          </Button>
        </div>
        
        {currentPath && (
          <div className="px-3 py-2 border-b border-border bg-secondary/30">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 px-2"
              onClick={goBack}
            >
              <ArrowLeft className="w-3 h-3" />
              Geri
            </Button>
            <span className="text-xs text-muted-foreground ml-2">/{currentPath}</span>
          </div>
        )}
        
        <div className="flex-1 overflow-y-auto">
          {loadingGithub && !currentRepoFiles.length ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="p-1">
              {currentRepoFiles.map((file) => (
                <div
                  key={file.sha}
                  className="group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:bg-secondary/50"
                  onClick={() => {
                    if (file.type === 'dir') {
                      loadRepoContents(file.path)
                    }
                  }}
                >
                  {file.type === 'dir' ? (
                    <Folder className="w-4 h-4 text-yellow-500 shrink-0" />
                  ) : (
                    <FileCode className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span className="flex-1 text-sm truncate">{file.name}</span>
                  {file.size && file.type === 'file' && (
                    <span className="text-xs text-muted-foreground">
                      {file.size > 1024 
                        ? `${(file.size / 1024).toFixed(1)}KB`
                        : `${file.size}B`
                      }
                    </span>
                  )}
                  {file.type === 'file' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        downloadFile(file)
                      }}
                      disabled={downloadingFiles.has(file.path) || shouldSkipFile(file.path)}
                    >
                      {downloadingFiles.has(file.path) ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Download className="w-3 h-3" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload dialog */}
        <Dialog open={uploadDialog} onOpenChange={setUploadDialog}>
          <DialogContent className="max-w-[90vw] sm:max-w-md">
            <DialogHeader>
              <DialogTitle>GitHub&apos;a Yukle</DialogTitle>
              <DialogDescription>
                Mevcut dosyalarinizi <b>{currentRepo.fullName}</b> reposuna commit olarak gonderir.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Branch (opsiyonel)</label>
                <Input
                  placeholder={`Orn: ${currentRepo.defaultBranch}`}
                  value={uploadBranch}
                  onChange={(e) => setUploadBranch(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Commit mesaji (opsiyonel)</label>
                <Input
                  placeholder="Orn: initial upload"
                  value={uploadMessage}
                  onChange={(e) => setUploadMessage(e.target.value)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Not: Bu islem tek tek dosyalari gunceller/olusturur. Buyuk projelerde biraz zaman alabilir.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setUploadDialog(false)} disabled={uploading}>
                Iptal
              </Button>
              <Button
                onClick={async () => {
                  setUploading(true)
                  setTerminalOpen(true)
                  addConsoleOutput({ type: 'info', content: `GitHub yukleme basladi: ${currentRepo.fullName}` })
                  const result = await pushCurrentProjectToGitHub({
                    repoFullName: currentRepo.fullName,
                    branch: uploadBranch.trim() || undefined,
                    message: uploadMessage.trim() || undefined,
                  })
                  if (result.success) {
                    addConsoleOutput({ type: 'result', content: `Basarili: ${result.pushed} dosya yuklendi.` })
                    setUploadDialog(false)
                    setUploadBranch('')
                    setUploadMessage('')
                  } else {
                    addConsoleOutput({ type: 'error', content: `Yukleme tamamlanamadi. ${result.pushed} dosya yuklendi.` })
                    result.errors.slice(0, 20).forEach(err => addConsoleOutput({ type: 'error', content: err }))
                  }
                  setUploading(false)
                }}
                disabled={uploading}
              >
                Yukle
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    )
  }
  
  // Show repos list
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <Github className="w-4 h-4" />
          GitHub
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={refreshRepos}
            disabled={loadingGithub}
          >
            <RefreshCw className={cn('w-3 h-3', loadingGithub && 'animate-spin')} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={disconnect}
          >
            <LogOut className="w-3 h-3" />
          </Button>
        </div>
      </div>
      
      <div className="p-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <Github className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">{githubUser}</p>
            <p className="text-xs text-muted-foreground">Bagli</p>
          </div>
        </div>

        {linkedRepo && (
          <Button
            variant="outline"
            className="w-full gap-2 mb-3"
            onClick={() => setLinkedUploadDialog(true)}
            disabled={loadingGithub || linkedUploading || files.length === 0}
            title="GitHub’dan indirilen projenin kendi repoya yukle"
          >
            {linkedUploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Yukleniyor...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Bagli Repoya Yukle
              </>
            )}
          </Button>
        )}
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Repo ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="p-2">
          <p className="text-xs font-medium text-muted-foreground px-2 py-1">
            Repolar ({filteredRepos.length})
          </p>
          <div className="space-y-1">
            {filteredRepos.map((repo) => (
              <div
                key={repo.id}
                className="group p-2 rounded cursor-pointer hover:bg-secondary/50"
                onClick={() => setCurrentRepo(repo)}
              >
                <div className="flex items-center gap-2">
                  <FolderGit2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="text-sm font-medium truncate flex-1">
                    {repo.name}
                  </span>
                </div>
                {repo.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2 pl-6">
                    {repo.description}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-1 pl-6">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <GitBranch className="w-3 h-3" />
                    {repo.defaultBranch}
                  </span>
                  <a
                    href={repo.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Linked repo upload dialog */}
      <Dialog open={linkedUploadDialog} onOpenChange={setLinkedUploadDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Bagli Repoya Yukle</DialogTitle>
            <DialogDescription>
              Bu proje daha once GitHub&apos;dan indirildi. Degisiklikler ayni depoya gonderilecek:
              <br />
              <b>{linkedRepo}</b>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Branch (opsiyonel)</label>
              <Input
                placeholder="Orn: main"
                value={linkedBranch}
                onChange={(e) => setLinkedBranch(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Commit mesaji (opsiyonel)</label>
              <Input
                placeholder="Orn: update"
                value={linkedMessage}
                onChange={(e) => setLinkedMessage(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLinkedUploadDialog(false)} disabled={linkedUploading}>
              Iptal
            </Button>
            <Button
              onClick={async () => {
                setLinkedUploading(true)
                setTerminalOpen(true)
                addConsoleOutput({ type: 'info', content: `GitHub yukleme basladi: ${linkedRepo}` })
                const result = await pushLinkedProjectToGitHub({
                  branch: linkedBranch.trim() || undefined,
                  message: linkedMessage.trim() || undefined,
                })
                if (result.success) {
                  addConsoleOutput({ type: 'result', content: `Basarili: ${result.pushed} dosya yuklendi.` })
                  setLinkedUploadDialog(false)
                  setLinkedBranch('')
                  setLinkedMessage('')
                } else {
                  addConsoleOutput({ type: 'error', content: `Yukleme tamamlanamadi. ${result.pushed} dosya yuklendi.` })
                  result.errors.slice(0, 20).forEach(err => addConsoleOutput({ type: 'error', content: err }))
                }
                setLinkedUploading(false)
              }}
              disabled={linkedUploading || !linkedRepo}
            >
              Yukle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
