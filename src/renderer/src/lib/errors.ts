// Plain-language help for failed commands. hintFor works with no model at all, so a beginner sees a
// useful sentence the moment something fails. explainPrompt asks the model to teach, not to change files.

type Rule = { test: RegExp; text: string }

const RULES: Rule[] = [
  { test: /EADDRINUSE|address already in use|port .* (is )?(already )?in use/i, text: 'That port is already being used by another program, maybe the same app still running. Close the other one, or start this app on a different port.' },
  { test: /is not recognized as an internal or external command|command not found|not found: (npm|node|python|pip|git)|'(npm|node|python|pip|git)' is not recognized/i, text: 'That program is not installed, or Windows cannot find it. Install it first (for example Node.js for npm), then reopen Setu so it can see it.' },
  { test: /Cannot find module|MODULE_NOT_FOUND|ModuleNotFoundError|No module named|Failed to resolve import|Module not found/i, text: 'A package the code needs is not installed yet. Run the install command first (npm install, or pip install -r requirements.txt) in the project folder.' },
  { test: /ENOENT[^\n]*package\.json|no such file or directory[^\n]*package\.json|Could not read package\.json/i, text: 'There is no package.json here, so you are probably in the wrong folder. Open the folder that contains your project files.' },
  { test: /EACCES|EPERM|permission denied|Access is denied/i, text: 'Windows or the system blocked this action. Try closing programs that use those files, and avoid protected folders like Program Files.' },
  { test: /SyntaxError|Unexpected token|Unexpected end of|invalid syntax|IndentationError/i, text: 'There is a typing mistake in the code: a missing bracket, quote or comma, or wrong indentation. The line number in the output shows where to look.' },
  { test: /ReferenceError: (\S+) is not defined|NameError: name '?(\S+?)'? is not defined/i, text: 'The code uses a name that was never created, or its spelling is different. Check for a typo or a missing import.' },
  { test: /TypeError: .*(undefined|null)|Cannot read propert(y|ies) of (undefined|null)|AttributeError: 'NoneType'/i, text: 'The code tried to use something that is empty. A value is missing, usually because data has not loaded yet or a name is spelled differently.' },
  { test: /ECONNREFUSED|ENOTFOUND|getaddrinfo|Failed to fetch|Network Error|ETIMEDOUT/i, text: 'The program could not reach a server. Check your internet, the address it is calling, and that the other program is running.' },
  { test: /heap out of memory|ENOMEM|MemoryError/i, text: 'The computer ran out of memory for this task. Close other programs, or try a smaller project or model.' },
  { test: /FAIL|failed|AssertionError|Expected .* (to|but)|assert/i, text: 'A test failed. It means the code did not give the result the test expected. The lines above show which test and what it expected.' }
]

/** One simple sentence for the most likely cause, or null if nothing matches. */
export function hintFor(output: string): string | null {
  const text = (output ?? '').slice(-8000)
  for (const r of RULES) if (r.test.test(text)) return r.text
  return null
}

const tail = (output: string): string => (output.length > 6000 ? '[...]\n' + output.slice(-6000) : output).trim()

export function fixPrompt(command: string, output: string, code: number | null): string {
  return `I ran \`${command}\` and it failed (code ${code ?? '?'}). Here is the output:\n\n\`\`\`\n${tail(output)}\n\`\`\`\n\nPlease find the problem and fix it.`
}

export function explainPrompt(command: string, output: string, code: number | null): string {
  return (
    `I ran \`${command}\` and it failed (code ${code ?? '?'}). Here is the output:\n\n\`\`\`\n${tail(output)}\n\`\`\`\n\n` +
    'Explain in very simple words what went wrong and why, as if I am a beginner. Say which file and line it points to. ' +
    'Do not change any files yet. Then give the fix in one or two short steps and ask if I want you to apply it.'
  )
}
