'use client'

import { useEffect, useMemo, useState } from 'react'
import { 
  File, 
  FileCode, 
  FileJson, 
  FileText, 
  FolderOpen,
  Folder,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  Edit3,
  MoreVertical,
  FileType,
  Download,
  Upload,
  Github,
  Trash,
  FolderUp
} from 'lucide-react'
import { useEditorStore, VSFile } from '@/lib/store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'

const fileTemplates = [
  { name: 'JavaScript', ext: '.js', icon: '📜' },
  { name: 'TypeScript', ext: '.ts', icon: '📘' },
  { name: 'HTML', ext: '.html', icon: '🌐' },
  { name: 'CSS', ext: '.css', icon: '🎨' },
  { name: 'Python', ext: '.py', icon: '🐍' },
  { name: 'JSON', ext: '.json', icon: '📋' },
  { name: 'Markdown', ext: '.md', icon: '📝' },
  { name: 'Plain Text', ext: '.txt', icon: '📄' },
]

const getFileIcon = (language: string) => {
  switch (language) {
    case 'javascript':
    case 'typescript':
      return <FileCode className="w-4 h-4 text-yellow-400" />
    case 'json':
      return <FileJson className="w-4 h-4 text-yellow-500" />
    case 'html':
      return <FileCode className="w-4 h-4 text-orange-500" />
    case 'css':
    case 'scss':
    case 'sass':
      return <FileCode className="w-4 h-4 text-blue-400" />
    case 'python':
      return <FileCode className="w-4 h-4 text-green-400" />
    case 'markdown':
      return <FileText className="w-4 h-4 text-blue-300" />
    default:
      return <File className="w-4 h-4 text-muted-foreground" />
  }
}

type TreeNode =
  | { type: 'dir'; name: string; path: string; children: TreeNode[] }
  | { type: 'file'; file: VSFile }

function normalizePath(path: string) {
  return (path || '').replace(/\\/g, '/').replace(/^\/+/, '').trim()
}

function buildTree(files: VSFile[]): TreeNode[] {
  const root: { type: 'dir'; name: string; path: string; children: TreeNode[] } = {
    type: 'dir',
    name: '',
    path: '',
    children: [],
  }

  const ensureDir = (parent: { children: TreeNode[] }, name: string, fullPath: string) => {
    const existing = parent.children.find(
      n => n.type === 'dir' && n.name.toLowerCase() === name.toLowerCase()
    ) as TreeNode | undefined
    if (existing && existing.type === 'dir') return existing
    const dir: TreeNode = { type: 'dir', name, path: fullPath, children: [] }
    parent.children.push(dir)
    return dir
  }

  for (const file of files) {
    const p = normalizePath(file.path || file.name)
    const parts = p ? p.split('/') : [file.name]
    let cursor: any = root
    let accum = ''
    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      if (!part) continue
      accum = accum ? `${accum}/${part}` : part
      cursor = ensureDir(cursor, part, accum)
    }
    cursor.children.push({ type: 'file', file })
  }

  const sortNode = (node: TreeNode) => {
    if (node.type === 'dir') {
      node.children.sort((a, b) => {
        if (a.type === b.type) {
          const an = a.type === 'dir' ? a.name : a.file.name
          const bn = b.type === 'dir' ? b.name : b.file.name
          return an.localeCompare(bn)
        }
        return a.type === 'dir' ? -1 : 1
      })
      node.children.forEach(sortNode)
    }
  }
  sortNode(root)
  return root.children
}

export function FileExplorer() {
  const {
    files,
    activeFileId,
    openFile,
    createFile,
    deleteFile,
    renameFile,
    clearAllFiles,
    setActivePanel,
    setSidebarOpen,
    githubToken,
    githubUser,
    pushCurrentProjectToGitHub,
    setTerminalOpen,
    addConsoleOutput,
  } = useEditorStore()
  const [newFileDialog, setNewFileDialog] = useState(false)
  const [newFileName, setNewFileName] = useState('')
  const [renameDialog, setRenameDialog] = useState<VSFile | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deleteAllDialog, setDeleteAllDialog] = useState(false)
  const [templateDialog, setTemplateDialog] = useState(false)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set(['']))

  const [githubUploadMenuOpen, setGithubUploadMenuOpen] = useState(false)
  const [githubMenuTab, setGithubMenuTab] = useState<'existing' | 'create'>('existing')
  const [githubReposLoading, setGithubReposLoading] = useState(false)
  const [githubReposError, setGithubReposError] = useState('')
  const [githubRepos, setGithubRepos] = useState<
    { id: number; name: string; fullName: string; description?: string; defaultBranch?: string }[]
  >([])
  const [githubRepoSearch, setGithubRepoSearch] = useState('')
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>('')

  const [createRepoName, setCreateRepoName] = useState('')
  const [createRepoDescription, setCreateRepoDescription] = useState('')
  const [createRepoPrivate, setCreateRepoPrivate] = useState(false)
  const [createRepoLoading, setCreateRepoLoading] = useState(false)
  const [createRepoError, setCreateRepoError] = useState('')

  const [githubPushBranch, setGithubPushBranch] = useState('')
  const [githubPushMessage, setGithubPushMessage] = useState('')
  const [githubPushing, setGithubPushing] = useState(false)
  const [githubPushError, setGithubPushError] = useState('')

  const filteredGithubRepos = useMemo(() => {
    const q = githubRepoSearch.trim().toLowerCase()
    if (!q) return githubRepos
    return githubRepos.filter(r =>
      r.name.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q) || r.fullName.toLowerCase().includes(q)
    )
  }, [githubRepoSearch, githubRepos])
  
  const handleCreateFile = () => {
    if (newFileName.trim()) {
      createFile(newFileName.trim())
      setNewFileName('')
      setNewFileDialog(false)
    }
  }
  
  const handleCreateFromTemplate = (ext: string) => {
    const baseName = 'yeni_dosya'
    let name = `${baseName}${ext}`
    let counter = 1
    
    while (files.some(f => f.name.toLowerCase() === name.toLowerCase())) {
      name = `${baseName}_${counter}${ext}`
      counter++
    }
    
    createFile(name)
    setTemplateDialog(false)
  }
  
  const handleRename = () => {
    if (renameDialog && renameValue.trim()) {
      renameFile(renameDialog.id, renameValue.trim())
      setRenameDialog(null)
      setRenameValue('')
    }
  }
  
  const handleImport = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.accept = '.js,.jsx,.ts,.tsx,.py,.html,.htm,.css,.scss,.json,.md,.txt,.xml,.svg,.vue,.svelte,.go,.rs,.java,.c,.cpp,.php,.rb,.swift,.kt,.yaml,.yml,.sh,.sql'
    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files
      if (fileList) {
        for (const file of Array.from(fileList)) {
          const content = await file.text()
          createFile(file.name, content)
        }
      }
    }
    input.click()
  }

  const handleImportFolder = () => {
    const input = document.createElement('input') as HTMLInputElement & { webkitdirectory?: boolean }
    input.type = 'file'
    input.multiple = true
    input.webkitdirectory = true
    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files
      if (fileList) {
        for (const file of Array.from(fileList)) {
          const content = await file.text()
          const rel = (file as any).webkitRelativePath as string | undefined
          createFile(rel && rel.includes('/') ? rel : file.name, content)
        }
      }
    }
    input.click()
  }
  
  const goToGitHubUpload = () => {
    setGithubUploadMenuOpen(true)
  }

  const fetchGitHubRepos = async () => {
    if (!githubToken) return
    setGithubReposLoading(true)
    setGithubReposError('')
    try {
      const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
        },
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`Repolar alinamadi (${res.status}) ${t ? t.slice(0, 120) : ''}`.trim())
      }
      const data = await res.json()
      setGithubRepos(
        (Array.isArray(data) ? data : []).map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          fullName: repo.full_name,
          description: repo.description || '',
          defaultBranch: repo.default_branch,
        }))
      )
    } catch (e) {
      setGithubReposError(e instanceof Error ? e.message : 'Repolar alinamadi')
    } finally {
      setGithubReposLoading(false)
    }
  }

  useEffect(() => {
    if (!githubUploadMenuOpen) return

    // Reset transient state each time menu opens.
    setGithubMenuTab('existing')
    setGithubReposError('')
    setGithubRepoSearch('')
    setSelectedRepoFullName('')
    setGithubPushBranch('')
    setGithubPushMessage('')
    setGithubPushError('')
    setGithubPushing(false)
    setCreateRepoName('')
    setCreateRepoDescription('')
    setCreateRepoPrivate(false)
    setCreateRepoError('')
    setCreateRepoLoading(false)

    if (githubToken) {
      fetchGitHubRepos()
    }
  }, [githubUploadMenuOpen])

  const doPushToRepo = async (repoFullName: string) => {
    if (!repoFullName) return
    setGithubPushing(true)
    setGithubPushError('')
    setTerminalOpen(true)
    addConsoleOutput({ type: 'info', content: `GitHub yukleme basladi: ${repoFullName}` })
    const result = await pushCurrentProjectToGitHub({
      repoFullName,
      branch: githubPushBranch.trim() || undefined,
      message: githubPushMessage.trim() || undefined,
    })
    if (result.success) {
      addConsoleOutput({ type: 'result', content: `Basarili: ${result.pushed} dosya yuklendi.` })
      setGithubUploadMenuOpen(false)
      setGithubPushBranch('')
      setGithubPushMessage('')
    } else {
      addConsoleOutput({ type: 'error', content: `Yukleme tamamlanamadi. ${result.pushed} dosya yuklendi.` })
      result.errors.slice(0, 20).forEach(err => addConsoleOutput({ type: 'error', content: err }))
      setGithubPushError(result.errors[0] || 'Yukleme basarisiz')
    }
    setGithubPushing(false)
  }

  const createRepoAndPush = async () => {
    if (!githubToken) return
    const name = createRepoName.trim()
    if (!name) {
      setCreateRepoError('Repo adi gerekli.')
      return
    }
    setCreateRepoLoading(true)
    setCreateRepoError('')
    try {
      const res = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          description: createRepoDescription.trim() || undefined,
          private: createRepoPrivate,
          auto_init: false,
        }),
      })
      if (!res.ok) {
        const t = await res.text().catch(() => '')
        throw new Error(`Repo olusturulamadi (${res.status}) ${t ? t.slice(0, 200) : ''}`.trim())
      }
      const repo = await res.json()
      const fullName = String(repo.full_name || '')
      if (!fullName.includes('/')) {
        throw new Error('Repo olustu ama isim okunamadi.')
      }
      await fetchGitHubRepos()
      setSelectedRepoFullName(fullName)
      setGithubMenuTab('existing')
      await doPushToRepo(fullName)
    } catch (e) {
      setCreateRepoError(e instanceof Error ? e.message : 'Repo olusturulamadi')
    } finally {
      setCreateRepoLoading(false)
    }
  }

  const tree = buildTree(files)

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderTree = (nodes: TreeNode[], depth: number) => {
    return nodes.map((node) => {
      if (node.type === 'dir') {
        const isOpen = expandedDirs.has(node.path)
        const key = `dir:${node.path}`
        return (
          <div key={key}>
            <div
              className={cn(
                'group flex items-center gap-2 px-2 py-2 rounded cursor-pointer touch-manipulation',
                'hover:bg-secondary/50 active:bg-secondary text-foreground'
              )}
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => toggleDir(node.path)}
            >
              <span className="w-4 h-4 flex items-center justify-center text-muted-foreground">
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </span>
              <Folder className="w-4 h-4 text-yellow-500 shrink-0" />
              <span className="flex-1 truncate text-sm">{node.name}</span>
            </div>
            {isOpen && (
              <div>{renderTree(node.children, depth + 1)}</div>
            )}
          </div>
        )
      }

      const file = node.file
      return (
        <div
          key={file.id}
          className={cn(
            'group flex items-center gap-2 px-2 py-2 rounded cursor-pointer touch-manipulation',
            activeFileId === file.id
              ? 'bg-accent text-accent-foreground'
              : 'hover:bg-secondary/50 active:bg-secondary text-foreground'
          )}
          style={{ paddingLeft: 8 + depth * 14 + 18 }}
          onClick={() => openFile(file.id)}
          title={file.path}
        >
          {getFileIcon(file.language)}
          <span className="flex-1 truncate text-sm">{file.name}</span>
          {file.isModified && (
            <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setRenameValue(file.path || file.name)
                  setRenameDialog(file)
                }}
              >
                <Edit3 className="w-4 h-4 mr-2" />
                Yeniden Adlandir
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  const blob = new Blob([file.content], { type: 'text/plain' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = file.name
                  a.click()
                  URL.revokeObjectURL(url)
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Indir
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={(e) => {
                  e.stopPropagation()
                  deleteFile(file.id)
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    })
  }
  
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
          <FolderOpen className="w-4 h-4" />
          Dosyalar
        </div>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <Plus className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setNewFileDialog(true)}>
                <File className="w-4 h-4 mr-2" />
                Yeni Dosya
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTemplateDialog(true)}>
                <FileType className="w-4 h-4 mr-2" />
                Sablondan Olustur
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleImport}>
                <Upload className="w-4 h-4 mr-2" />
                Iceaktar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleImportFolder}>
                <FolderUp className="w-4 h-4 mr-2" />
                Klasor Ice Aktar
              </DropdownMenuItem>
              {files.length > 0 && (
                <>
                  <DropdownMenuItem onClick={goToGitHubUpload}>
                    <Github className="w-4 h-4 mr-2" />
                    GitHub&apos;a Yukle
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem 
                    className="text-destructive"
                    onClick={() => setDeleteAllDialog(true)}
                  >
                    <Trash className="w-4 h-4 mr-2" />
                    Tumunu Sil
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-1">
        {files.length === 0 ? (
          <div className="p-4 text-center text-sm text-muted-foreground">
            <FolderOpen className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
            <p className="mb-3">Henuz dosya yok</p>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setTemplateDialog(true)}
              >
                <Plus className="w-4 h-4 mr-1" />
                Dosya Olustur
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={handleImport}
              >
                <Upload className="w-4 h-4 mr-1" />
                Dosya Ice Aktar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-0.5">
            {renderTree(tree, 0)}
          </div>
        )}
      </div>
      
      {/* New File Dialog */}
      <Dialog open={newFileDialog} onOpenChange={setNewFileDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Yeni Dosya Olustur</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Dosya adi (orn: index.html)"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateFile()}
            autoFocus
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setNewFileDialog(false)}>
              Iptal
            </Button>
            <Button onClick={handleCreateFile}>Olustur</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Template Dialog */}
      <Dialog open={templateDialog} onOpenChange={setTemplateDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dosya Tipi Sec</DialogTitle>
            <DialogDescription>
              Hangi turu dosya olusturmak istiyorsunuz?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {fileTemplates.map((template) => (
              <Button
                key={template.ext}
                variant="outline"
                className="h-auto py-3 flex-col gap-1"
                onClick={() => handleCreateFromTemplate(template.ext)}
              >
                <span className="text-lg">{template.icon}</span>
                <span className="text-xs">{template.name}</span>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Rename Dialog */}
      <Dialog open={!!renameDialog} onOpenChange={() => setRenameDialog(null)}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dosyayi Yeniden Adlandir</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Yeni dosya adi"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRename()}
            autoFocus
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setRenameDialog(null)}>
              Iptal
            </Button>
            <Button onClick={handleRename}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Delete All Dialog */}
      <Dialog open={deleteAllDialog} onOpenChange={setDeleteAllDialog}>
        <DialogContent className="max-w-[90vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Tum Dosyalari Sil</DialogTitle>
            <DialogDescription>
              Bu islem geri alinamaz. Tum dosyalariniz kalici olarak silinecek.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteAllDialog(false)}>
              Iptal
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => {
                clearAllFiles()
                setDeleteAllDialog(false)
              }}
            >
              Tumunu Sil
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* GitHub upload menu */}
      <Dialog open={githubUploadMenuOpen} onOpenChange={setGithubUploadMenuOpen}>
        <DialogContent className="max-w-[90vw] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>GitHub&apos;a Yukle</DialogTitle>
            <DialogDescription>
              Mevcut depolarinizdan birini secin veya yeni bir depo olusturun.
            </DialogDescription>
          </DialogHeader>

          {!githubToken ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Devam etmek icin once GitHub&apos;a baglanmaniz gerekiyor.
              </p>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setGithubUploadMenuOpen(false)
                    setActivePanel('git')
                    setSidebarOpen(true)
                  }}
                >
                  GitHub&apos;a Baglan
                </Button>
                <Button variant="outline" className="flex-1" onClick={() => setGithubUploadMenuOpen(false)}>
                  Kapat
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Button
                  variant={githubMenuTab === 'existing' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setGithubMenuTab('existing')}
                >
                  Mevcut Depolar
                </Button>
                <Button
                  variant={githubMenuTab === 'create' ? 'default' : 'outline'}
                  className="flex-1"
                  onClick={() => setGithubMenuTab('create')}
                >
                  Yeni Depo Olustur
                </Button>
              </div>

              {githubMenuTab === 'existing' ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Repo ara..."
                      value={githubRepoSearch}
                      onChange={(e) => setGithubRepoSearch(e.target.value)}
                      className="h-8 text-sm"
                    />
                    <Button
                      variant="outline"
                      className="h-8"
                      onClick={fetchGitHubRepos}
                      disabled={githubReposLoading}
                      title="Repolari yenile"
                    >
                      Yenile
                    </Button>
                  </div>

                  {githubReposError && (
                    <p className="text-sm text-destructive">{githubReposError}</p>
                  )}

                  <div className="max-h-56 overflow-y-auto rounded-md border border-border">
                    {githubReposLoading ? (
                      <div className="p-3 text-sm text-muted-foreground">Repolar yukleniyor...</div>
                    ) : filteredGithubRepos.length === 0 ? (
                      <div className="p-3 text-sm text-muted-foreground">Repo bulunamadi.</div>
                    ) : (
                      <div className="divide-y divide-border">
                        {filteredGithubRepos.map((r) => {
                          const selected = selectedRepoFullName === r.fullName
                          return (
                            <button
                              key={r.id}
                              type="button"
                              className={cn(
                                'w-full text-left p-3 hover:bg-secondary/50 transition-colors',
                                selected && 'bg-primary/10'
                              )}
                              onClick={() => setSelectedRepoFullName(r.fullName)}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{r.fullName}</div>
                                  {!!r.description && (
                                    <div className="text-xs text-muted-foreground line-clamp-1">{r.description}</div>
                                  )}
                                </div>
                                {selected && (
                                  <span className="text-xs text-primary font-medium">Secildi</span>
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Branch (opsiyonel)</label>
                      <Input
                        placeholder="Orn: main"
                        value={githubPushBranch}
                        onChange={(e) => setGithubPushBranch(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">Commit mesaji (opsiyonel)</label>
                      <Input
                        placeholder="Orn: initial upload"
                        value={githubPushMessage}
                        onChange={(e) => setGithubPushMessage(e.target.value)}
                      />
                    </div>
                  </div>

                  {githubPushError && (
                    <p className="text-sm text-destructive">{githubPushError}</p>
                  )}

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setGithubUploadMenuOpen(false)} disabled={githubPushing}>
                      Iptal
                    </Button>
                    <Button
                      onClick={() => doPushToRepo(selectedRepoFullName)}
                      disabled={githubPushing || !selectedRepoFullName || files.length === 0}
                      title={files.length === 0 ? 'Once dosya/proje olusturun' : undefined}
                    >
                      {githubPushing ? 'Yukleniyor...' : 'Yukle'}
                    </Button>
                  </DialogFooter>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Repo Adi</label>
                      <Input
                        placeholder="ornek-repo"
                        value={createRepoName}
                        onChange={(e) => setCreateRepoName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Aciklama (Opsiyonel)</label>
                      <Input
                        placeholder="Repo aciklamasi"
                        value={createRepoDescription}
                        onChange={(e) => setCreateRepoDescription(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        checked={createRepoPrivate}
                        onCheckedChange={(v) => setCreateRepoPrivate(Boolean(v))}
                        id="gh-private"
                      />
                      <label htmlFor="gh-private" className="text-sm">
                        Private repo
                      </label>
                      {githubUser && (
                        <span className="ml-auto text-xs text-muted-foreground">
                          Hesap: {githubUser}
                        </span>
                      )}
                    </div>
                  </div>

                  {createRepoError && (
                    <p className="text-sm text-destructive">{createRepoError}</p>
                  )}

                  <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => setGithubUploadMenuOpen(false)} disabled={createRepoLoading}>
                      Iptal
                    </Button>
                    <Button
                      onClick={createRepoAndPush}
                      disabled={createRepoLoading || githubPushing || !createRepoName.trim() || files.length === 0}
                      title={files.length === 0 ? 'Once dosya/proje olusturun' : undefined}
                    >
                      {createRepoLoading ? 'Olusturuluyor...' : 'Olustur ve Yukle'}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
