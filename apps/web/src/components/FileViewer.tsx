'use client'

import { useState, useEffect } from 'react'
import { FileText, Edit, Save, X } from 'lucide-react'
import dynamic from 'next/dynamic'
import '@uiw/react-md-editor/markdown-editor.css'
import '@uiw/react-markdown-preview/markdown.css'

const MDEditor = dynamic(
  () => import('@uiw/react-md-editor').then((mod) => mod.default),
  { ssr: false }
)

const MarkdownPreview = dynamic(
  () => import('@uiw/react-markdown-preview').then((mod) => mod.default),
  { ssr: false }
)

interface FileViewerProps {
  file: { path: string; content: string } | null
  onFileSaved?: () => void
}

export default function FileViewer({ file, onFileSaved }: FileViewerProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (file) {
      setContent(file.content)
      setIsEditing(false)
    }
  }, [file])

  const handleSave = async () => {
    if (!file) return

    setIsSaving(true)
    try {
      const response = await fetch('/api/file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: file.path, content })
      })

      if (response.ok) {
        setIsEditing(false)
        if (onFileSaved) onFileSaved()
      }
    } catch (error) {
      console.error('Failed to save file:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setContent(file?.content || '')
    setIsEditing(false)
  }

  if (!file) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-900">
        <div className="text-center text-gray-500">
          <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>Select a file to view</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-gray-900">
      <div className="flex items-center justify-between p-3 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-200 truncate">{file.path.split('/').pop()}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 truncate max-w-md mr-4">{file.path}</span>
          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="flex items-center gap-1 px-3 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
                disabled={isSaving}
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
                disabled={isSaving}
              >
                <Save className="w-4 h-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-1 px-3 py-1 text-sm text-gray-300 hover:text-white hover:bg-gray-700 rounded transition-colors"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto" data-color-mode="dark">
        {isEditing ? (
          <MDEditor
            value={content}
            onChange={(val) => setContent(val || '')}
            height="100%"
            preview="edit"
            hideToolbar={false}
          />
        ) : (
          <div className="p-4">
            <MarkdownPreview
              source={content}
              style={{
                background: 'transparent',
                color: '#d1d5db',
                fontSize: '14px'
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
