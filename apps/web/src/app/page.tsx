"use client";

import * as React from "react";
import FileBrowser from "@/components/FileBrowser";
import FileViewer from "@/components/FileViewer";
import TaskKanban from "@/components/TaskKanban";
import EpicsKanban from "@/components/EpicsKanban";
import { Kanban, Files, Layers, FolderGit2, Lightbulb, BookOpen, Map, Terminal, ListTodo } from "lucide-react";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  content?: string;
}

type ViewMode = "ideas" | "docs" | "plan" | "epics" | "tasks" | "commands" | "browser" | "kanban";

interface Task {
  id: string;
  title: string;
  description: string;
  state: "pending" | "doing" | "done";
  createdAt: string;
  epic?: string;
  assignee?: string;
  path?: string;
}

interface Epic {
  id: string;
  title: string;
  description: string;
  state: "backlog" | "priority" | "pending" | "doing" | "done";
  createdAt: string;
  path?: string;
}

export default function Home() {
  const [repositories, setRepositories] = React.useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = React.useState<string | null>(null);
  const [currentPath, setCurrentPath] = React.useState<string>("");
  const [fileTree, setFileTree] = React.useState<FileNode | null>(null);
  const [selectedFile, setSelectedFile] = React.useState<{
    path: string;
    content: string;
  } | null>(null);
  const [basePath, setBasePath] = React.useState<string>("");
  const [viewMode, setViewMode] = React.useState<ViewMode>("epics");

  React.useEffect(() => {
    fetch("/api/repositories")
      .then((res) => res.json())
      .then((data) => {
        setRepositories(data.repositories || []);
        if (data.basePath) setBasePath(data.basePath);
        if (data.repositories?.length > 0) {
          setSelectedRepo(data.repositories[0]);
        }
      });
  }, []);

  const loadFileTree = () => {
    if (selectedRepo) {
      let url = `/api/files?repo=${selectedRepo}`;
      if (viewMode === 'ideas') url += '&path=ideas';
      if (viewMode === 'docs') url += '&path=docs';
      if (viewMode === 'plan') url += '&path=plan';
      if (viewMode === 'commands') url += '&path=commands';
      
      fetch(url)
        .then((res) => res.json())
        .then((data) => {
          setFileTree(data.tree);
          setCurrentPath(data.rootPath);
        });
    }
  };

  React.useEffect(() => {
    loadFileTree();
  }, [selectedRepo, viewMode]);

  const handleFileSelect = async (node: FileNode) => {
    if (node.type === "file") {
      const content = await fetch(
        `/api/file?path=${encodeURIComponent(node.path)}`
      ).then((res) => res.json());
      setSelectedFile({ path: node.path, content: content.content || "" });
    }
  };

  const handleTaskSelect = (task: Task) => {
    if (!selectedRepo || !task.id) return;

    const fallbackPath =
      basePath && selectedRepo
        ? `${basePath}/${selectedRepo}/agelum/tasks/${task.state}/${task.epic ? `${task.epic}/` : ""}${task.id}.md`
        : "";

    const filePath = task.path || fallbackPath;
    if (!filePath) return;

    fetch(`/api/file?path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        setSelectedFile({ path: filePath, content: data.content || "" });
      });
  };

  const handleEpicSelect = (epic: Epic) => {
    if (!selectedRepo || !epic.id) return;

    const fallbackPath =
      basePath && selectedRepo
        ? `${basePath}/${selectedRepo}/agelum/epics/${epic.state}/${epic.id}.md`
        : "";

    const filePath = epic.path || fallbackPath;
    if (!filePath) return;

    fetch(`/api/file?path=${encodeURIComponent(filePath)}`)
      .then((res) => res.json())
      .then((data) => {
        setSelectedFile({ path: filePath, content: data.content || "" });
      });
  };

  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-gray-800">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <FolderGit2 className="w-6 h-6 text-blue-400" />
            <span className="text-xl font-bold">Agelum</span>
          </div>

          <div className="h-6 w-px bg-gray-700 mx-2" />

          <div className="flex items-center gap-1">
            <button
              onClick={() => setViewMode("ideas")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                viewMode === "ideas"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Ideas
            </button>
            <button
              onClick={() => setViewMode("docs")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                viewMode === "docs"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Docs
            </button>
            <button
              onClick={() => setViewMode("plan")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                viewMode === "plan"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Map className="w-4 h-4" />
              Plan
            </button>
            <button
              onClick={() => setViewMode("epics")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                viewMode === "epics"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Layers className="w-4 h-4" />
              Epics
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                viewMode === "kanban"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <ListTodo className="w-4 h-4" />
              Tasks
            </button>
            <button
              onClick={() => setViewMode("commands")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                viewMode === "commands"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Terminal className="w-4 h-4" />
              Commands
            </button>
            <button
              onClick={() => setViewMode("browser")}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
                viewMode === "browser"
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              <Files className="w-4 h-4" />
              Files
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={selectedRepo || ""}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className="bg-gray-700 text-gray-100 text-sm rounded-lg border-none focus:ring-2 focus:ring-blue-500 p-1.5 min-w-[160px]"
          >
            <option value="" disabled>Select repository</option>
            {repositories.map((repo) => (
              <option key={repo} value={repo}>
                {repo}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 flex overflow-hidden">
          {["browser", "ideas", "docs", "plan", "commands"].includes(viewMode) ? (
            <>
              <FileBrowser
                fileTree={fileTree}
                currentPath={currentPath}
                onFileSelect={handleFileSelect}
                basePath={basePath}
                onRefresh={loadFileTree}
              />
              <FileViewer file={selectedFile} onFileSaved={loadFileTree} />
            </>
          ) : viewMode === "epics" ? (
            <div className="flex-1 bg-background">
              {selectedFile ? (
                <FileViewer
                  file={selectedFile}
                  onFileSaved={loadFileTree}
                  onBack={() => setSelectedFile(null)}
                />
              ) : selectedRepo ? (
                <EpicsKanban
                  repo={selectedRepo}
                  onEpicSelect={handleEpicSelect}
                />
              ) : null}
            </div>
          ) : (
            <div className="flex-1 bg-background">
              {selectedFile ? (
                <FileViewer
                  file={selectedFile}
                  onFileSaved={loadFileTree}
                  onBack={() => setSelectedFile(null)}
                />
              ) : selectedRepo ? (
                <TaskKanban
                  repo={selectedRepo}
                  onTaskSelect={handleTaskSelect}
                />
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
