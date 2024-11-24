const output = document.getElementById("output");
function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    document.cookie = `${name}=${encodeURIComponent(value)};expires=${date.toUTCString()};path=/`;
}

function getCookie(name) {
    const nameEQ = `${name}=`;
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
        let c = ca[i];
        while (c.charAt(0) === ' ') c = c.substring(1, c.length);
        if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
    }
    return null;
}

require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.34.0/min/vs' } });

require(['vs/editor/editor.main'], function () {
    let editor; // Global editor instance
    const languagePicker = document.getElementById('language-picker');
    const savedContent = getCookie("editorContent") || `// Start coding here...`;

    // Function to create/reinitialize the editor
    function createEditor(language) {
        if (editor) {
            // Dispose the existing editor instance
            editor.dispose();
        }

        editor = monaco.editor.create(document.getElementById('code'), {
            value: savedContent,
            language: language,
            theme: 'hc-black',
            automaticLayout: true,
            lineNumbers: "on",
            fontSize: 15,
        });

        editor.onDidChangeModelContent(() => {
            setCookie("editorContent", editor.getValue(), 7); // Save content to cookie
        });

        // Register completion providers for Python or JavaScript
        if (language === 'python') {
            monaco.languages.registerCompletionItemProvider('python', {
                provideCompletionItems: function (model, position) {
                    const word = model.getWordUntilPosition(position);
                    const prefix = word.word.toLowerCase();

                    const filteredSuggestions = pythonSuggestions
                        .filter(keyword => keyword.toLowerCase().startsWith(prefix))
                        .map(keyword => ({
                            label: keyword,
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: keyword,
                            range: {
                                startLineNumber: position.lineNumber,
                                startColumn: word.startColumn,
                                endLineNumber: position.lineNumber,
                                endColumn: word.endColumn,
                            },
                        }));

                    return { suggestions: filteredSuggestions };
                },
            });
        } else if (language === 'javascript') {
            monaco.languages.registerCompletionItemProvider('javascript', {
                provideCompletionItems: function (model, position) {
                    const word = model.getWordUntilPosition(position);
                    const prefix = word.word.toLowerCase();

                    const filteredSuggestions = javascriptSuggestions
                        .filter(keyword => keyword.toLowerCase().startsWith(prefix))
                        .map(keyword => ({
                            label: keyword,
                            kind: monaco.languages.CompletionItemKind.Keyword,
                            insertText: keyword,
                            range: {
                                startLineNumber: position.lineNumber,
                                startColumn: word.startColumn,
                                endLineNumber: position.lineNumber,
                                endColumn: word.endColumn,
                            },
                        }));

                    return { suggestions: filteredSuggestions };
                },
            });
        }
    }

    createEditor(languagePicker.value);

    languagePicker.addEventListener('change', () => {
        const selectedLanguage = languagePicker.value;
        createEditor(selectedLanguage);
    });

    async function main() {
        let pyodide = await loadPyodide({ indexURL: "https://cdn.jsdelivr.net/pyodide/v0.18.1/full/" });
        await pyodide.loadPackage('micropip');
        await pyodide.loadPackage('requests');

        await pyodide.runPythonAsync(`
        import micropip
        
        await micropip.install('httpx')
    `);
        output.value += "Ready!\n";
        return pyodide;
    }

    let pyodideReadyPromise = main();
    async function evaluatePython() {
        let pyodide = await pyodideReadyPromise;
        try {
            const code = editor.getValue();
            console.log(code);
            pyodide.runPython(`
import sys
import io
sys.stdout = io.StringIO()

# Define a custom input function
def input(prompt=""):
    sys.stdout.write(prompt)
    user_input = js_input(prompt)
    sys.stdout.write(user_input + "\\n")  # Include the input in the output
    return user_input
`);

            pyodide.globals.set("js_input", (prompt) => {
                let userInput = window.prompt(prompt);
                return userInput || "";
            });

            let outputValue = pyodide.runPython(code);

            let printedOutput = pyodide.runPython("sys.stdout.getvalue()");

            addToOutput(printedOutput + (outputValue ? outputValue : ""));
        } catch (err) {
            console.error(err);
            addToOutput(err);
        }
    }
    function addToOutput(s) {
        output.value += ">>> " + s + "\n";
    }
    function evaluateJavaScript(code) {
        // Save the original console methods
        const originalLog = console.log;
        const originalError = console.error;

        // Override console.log to update the output field
        console.log = function (message) {
            output.value += "LOG: " + message + "\n";
            originalLog.apply(console, arguments); // Call the original method
        };

        // Override console.error to update the output field
        console.error = function (message) {
            output.value += "ERROR: " + message + "\n";
            originalError.apply(console, arguments); // Call the original method
        };

        try {
            const result = eval(code);
            output.value += "RESULT: " + result + "\n";
        } catch (err) {
            output.value += "EVAL ERROR: " + err + "\n";
        } finally {
            // Restore the original methods after execution
            console.log = originalLog;
            console.error = originalError;
        }
    }

    function evaluate() {
        const language = languagePicker.value;
        const code = editor.getValue();

        if (language === 'python') {
            evaluatePython(code);
        } else if (language === 'javascript') {
            evaluateJavaScript(code);
        }
    }

    document.getElementById('run').addEventListener('click', evaluate);
});

// Suggestions for Python
const pythonSuggestions = [
    'def', 'class', 'import', 'from', 'for', 'while', 'if', 'else', 'elif', 'return', 'print', 'input', 'try', 'except',
    'with', 'as', 'True', 'False', 'None', 'list', 'dict', 'set', 'tuple', 'int', 'float', 'str', 'len', 'range', 'map',
    'filter', 'lambda', 'open', 'read', 'write', 'append', 'in', 'is', 'not', 'and', 'or', 'break', 'continue', 'pass',
    'global', 'nonlocal', 'yield', 'raise', 'super', 'self', 'init', 'del', 'str', 'repr', 'format', 'abs', 'all', 'any',
    'bin', 'bool', 'bytearray', 'bytes', 'callable', 'chr', 'classmethod', 'compile', 'complex', 'delattr', 'dir', 'divmod',
    'enumerate', 'eval', 'exec', 'exit', 'float', 'format', 'frozenset', 'getattr', 'globals', 'hasattr', 'hash', 'help',
    'hex', 'id', 'input', 'isinstance', 'issubclass', 'iter', 'len', 'list', 'locals', 'map', 'max', 'min', 'next', 'object',
    'oct', 'ord', 'pow', 'print', 'property', 'range', 'repr', 'reversed', 'round', 'set', 'setattr', 'slice', 'sorted',
    'staticmethod', 'str', 'sum', 'super', 'tuple', 'type', 'vars', 'zip',
];

// Suggestions for JavaScript
const javascriptSuggestions = [
    'break', 'case', 'catch', 'class', 'const', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends',
    'finally', 'for', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new', 'return', 'super', 'switch', 'this',
    'throw', 'try', 'typeof', 'var', 'void', 'while', 'with', 'yield', 'async', 'await', 'Array', 'Boolean', 'Date', 'Error',
    'Function', 'JSON', 'Map', 'Math', 'Number', 'Object', 'Promise', 'RegExp', 'Set', 'String', 'Symbol', 'WeakMap', 'WeakSet',
    'console', 'window', 'document', 'querySelector', 'addEventListener', 'setTimeout', 'setInterval', 'eval', 'isNaN',
    'parseFloat', 'parseInt',
];
function promptUser(prompt) {
    return window.prompt(prompt);
}