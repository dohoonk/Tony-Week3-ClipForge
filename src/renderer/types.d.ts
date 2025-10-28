interface Window {
  clipforge: {
    openFiles: () => Promise<string[]>
    probe: (path: string) => Promise<{ duration: number; width: number; height: number }>
  }
}

