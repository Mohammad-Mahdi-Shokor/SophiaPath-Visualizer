import React, { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import {
  Box,
  Typography,
  Button,
  Paper,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip
} from '@mui/material';
import {
  Close as CloseIcon,
  EmojiEvents as TrophyIcon,
  Terminal as TerminalIcon
} from '@mui/icons-material';
import { UmlDiagram } from './course/UmlDiagram';

const translateCppToJs = (cppCode, inputStr) => {
  let code = cppCode
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 

  const mainBodyMatch = /int\s+main\s*\(\s*\)\s*\{([\s\S]*)\}/.exec(code);
  if (!mainBodyMatch) {
    throw new Error("Missing int main() structure.");
  }
  let body = mainBodyMatch[1].trim();
  body = body.replace(/\breturn\s+0\s*;/g, "");

  let js = `
    const stdout = [];
    const inputTokens = ${JSON.stringify(inputStr.trim().split(/\s+/).filter(t => t.length > 0))};
    let inputPtr = 0;
    
    const nextInputToken = () => {
      if (inputPtr >= inputTokens.length) return "";
      return inputTokens[inputPtr++];
    };

    const readInput = () => {
      const token = nextInputToken();
      if (!token) return "";
      if (/^-?\\d+(\\.\\d+)?$/.test(token)) {
        return parseFloat(token);
      }
      return token;
    };
  `;

  body = body.replace(/std::cout/g, "cout").replace(/std::cin/g, "cin").replace(/std::endl/g, "endl");

  const types = ['int', 'double', 'float', 'string', 'bool', 'char', 'auto'];
  types.forEach(type => {
    const regex = new RegExp(`\\b${type}\\b`, 'g');
    body = body.replace(regex, 'let');
  });

  const cinRegex = /cin\s*(>>\s*[a-zA-Z_][a-zA-Z0-9_]*\s*)+;/g;
  body = body.replace(cinRegex, (match) => {
    const vars = match.split('>>').slice(1).map(v => v.replace(/;$/, '').trim());
    return vars.map(v => `${v} = readInput();`).join(' ');
  });

  const coutRegex = /cout\s*(<<\s*[^;]+)+;/g;
  body = body.replace(coutRegex, (match) => {
    const parts = match.split('<<').slice(1).map(p => p.replace(/;$/, '').trim());
    const pushes = parts.map(part => {
      if (part === 'endl' || part === '"\\n"' || part === "'\\n'") {
        return `stdout.push("\\n");`;
      }
      return `stdout.push(${part});`;
    });
    return pushes.join(' ');
  });

  js += "\n" + body;
  js += `\nreturn stdout.join("");`;
  return js;
};

const translateJavaToJs = (javaCode, inputStr) => {
  let code = javaCode
    .replace(/\/\/.*$/gm, "") 
    .replace(/\/\*[\s\S]*?\*\//g, ""); 

  code = code.replace(/import\s+[\w.]+;/g, "");
  code = code.replace(/@\w+/g, "");
  
  code = code.replace(/\binterface\s+(\w+)/g, "class $1");
  code = code.replace(/\bextends\s+Exception\b/g, "extends Error");
  
  const extendsMap = {};
  code = code.replace(/\b(public\s+|abstract\s+|static\s+)*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w\s,]+)?/g, (match, modifiers, className, parentClass) => {
    let res = `class ${className}`;
    if (parentClass) {
      res += ` extends ${parentClass}`;
      extendsMap[className] = true;
    }
    return res;
  });

  code = code.replace(/\bimplements\s+[\w\s,]+/g, "");

  const classRegex = /class\s+(\w+)/g;
  let match;
  const classNames = [];
  while ((match = classRegex.exec(code)) !== null) {
    classNames.push(match[1]);
  }

  // Constructors
  classNames.forEach(className => {
    const constrRegex = new RegExp(`\\b(?:public|private|protected|internal)?\\s*${className}\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[\\w\\s,]+)?\\s*\\{`, 'g');
    code = code.replace(constrRegex, (match, paramStr) => {
      let cleaned = paramStr;
      if (typeof cleanParamTypes !== 'undefined') {
        cleaned = cleanParamTypes(paramStr);
      } else {
        cleaned = paramStr.split(',').map(p => {
          if (!p.trim()) return '';
          const parts = p.trim().split(/\s+/);
          return parts[parts.length - 1];
        }).filter(p => p).join(', ');
      }
      let res = `constructor(${cleaned}) {`;
      if (extendsMap[className]) {
        res += ' super();';
      }
      return res;
    });
  });

  // Methods
  code = code.replace(/(?:public|private|protected|static|final|abstract|synchronized|volatile|\s)*\b[a-zA-Z_][a-zA-Z0-9_<>[\]]*\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?:throws\s+[a-zA-Z0-9_,\s]+)?\s*(\{|;)/g, (match, methodName, params, brace) => {
    const keywords = ['if', 'for', 'while', 'switch', 'catch', 'return', 'new', 'else'];
    if (keywords.includes(methodName) || match.includes("new ") || match.includes("=")) return match;
    const isStatic = match.includes("static") ? "static " : "";
    const cleanParams = params.split(',').map(p => {
        if (!p.trim()) return '';
        const parts = p.trim().split(/\\s+/);
        return parts[parts.length - 1];
    }).filter(p => p).join(', ');
    return `\n${isStatic}${methodName}(${cleanParams}) ${brace === ';' ? '{}' : '{'}`;
  });
  
  code = code.replace(/\b(?:public|private|protected|final|abstract|synchronized|transient|volatile)\b/g, "");

  // Types
  const types = ['int', 'double', 'float', 'boolean', 'char', 'String', 'Shape', 'Circle', 'Rectangle', 'Employee', 'Contractor', 'Appliance', 'WashingMachine', 'Refrigerator', 'Product', 'Payable', 'BankAccount', 'Scanner', 'Vehicle', 'Car', 'Motorcycle', 'Drawable', 'Speaker', 'Mover', 'Dog', 'Cat', 'Robot', 'Bird', 'Animal', 'Cow', 'Geometry', 'Exception', 'InvalidAgeException', 'InvalidEmailException', 'InsufficientFundsException', 'InvalidPasswordException', 'Object', 'SalariedEmployee', 'HourlyEmployee', 'Comparable'];
  types.forEach(type => {
    const varDeclRegex = new RegExp(`\\b${type}(?:\\[\\])?\\s+(?!extends\\b|implements\\b|instanceof\\b)([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g');
    code = code.replace(varDeclRegex, '$1');
  });

  code = code.replace(/=\s*\{([^}]+)\}/g, '= [$1]');
  code = code.replace(/for\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\)/g, 'for (let $1 of $2)');
  code = code.replace(/\(\([a-zA-Z_][a-zA-Z0-9_]*\)\s*([a-zA-Z_][a-zA-Z0-9_]*)\)/g, '$1');
  code = code.replace(/\(\s*[a-zA-Z_][a-zA-Z0-9_]*\s*\)\s*([a-zA-Z_][a-zA-Z0-9_]*)/g, '$1');
  code = code.replace(/([a-zA-Z_][a-zA-Z0-9_]*)\s+instanceof\s+([a-zA-Z_][a-zA-Z0-9_]*)/g, '$1 instanceof $2');

  code = code.replace(/System\.out\.println\s*\(([^;]*)\)\s*;/g, 'stdout.push($1); stdout.push("\\n");');
  code = code.replace(/System\.out\.print\s*\(([^;]*)\)\s*;/g, 'stdout.push($1);');
  code = code.replace(/System\.out\.printf\s*\(([^;]+)\)\s*;/g, 'stdout.push(sprintf($1));');

  code = code.replace(/\be\.getMessage\(\)/g, "e.message");
  code = code.replace(/new\s+Scanner\s*\([^)]*\)/g, "null");
  code = code.replace(/\b[a-zA-Z0-9_]+\.(?:nextInt|nextDouble|next|nextLine)\(\)/g, "readInput()");

  // Cleanup duplicate super() injected by extends logic if the user already wrote super()
  code = code.replace(/super\(\);\s*super\(/g, "super(");

  let js = `
    const stdout = [];
    const inputTokens = ${JSON.stringify(inputStr.trim().split(/\s+/).filter(t => t.length > 0))};
    let inputPtr = 0;
    
    const nextInputToken = () => {
      if (inputPtr >= inputTokens.length) return "";
      return inputTokens[inputPtr++];
    };

    const readInput = () => {
      const token = nextInputToken();
      if (!token) return "";
      if (/^-?\\d+(\\.\\d+)?$/.test(token)) {
        return parseFloat(token);
      }
      return token;
    };

    const sprintf = (...args) => {
      if (args.length === 0) return "";
      let str = args[0];
      if (typeof str === 'string' && str.startsWith('"') && str.endsWith('"')) {
          str = str.slice(1, -1);
      }
      const formatArgs = args.slice(1);
      formatArgs.forEach(arg => {
        if (str.includes("%.2f")) {
          str = str.replace("%.2f", Number(arg).toFixed(2));
        } else if (str.includes("%.1f")) {
          str = str.replace("%.1f", Number(arg).toFixed(1));
        } else if (str.includes("%s")) {
          str = str.replace("%s", String(arg));
        } else if (str.includes("%d")) {
          str = str.replace("%d", Math.round(Number(arg)));
        } else {
          str = str.replace(/%[a-zA-Z]/, String(arg));
        }
      });
      return str.replace(/\\\\n/g, '\\n');
    };
  `;

  js += "\n" + code;
  js += `\n// Execute main\nif (typeof Main !== 'undefined' && Main.main) { Main.main([]); }`;
  js += `\nreturn stdout.join("");`;
  return js;
};

const simulateCodeExecution = (code, inputStr = "", language = "cpp", hiddenMain = null) => {
  try {
    const isJava = language.toLowerCase() === 'java' || code.includes('class ') || code.includes('System.out');
    let fullCode = code;
    if (hiddenMain && !code.includes('main')) {
      // Extract the body of Main.main from hiddenMain to run globally
      const mainMatch = hiddenMain.match(/public\s+static\s+void\s+main\s*\([^)]*\)\s*\{([\s\S]*)\}\s*\}/);
      if (mainMatch) {
        fullCode += '\n' + mainMatch[1];
      } else {
        fullCode += '\n' + hiddenMain;
      }
    }
    let jsCode = isJava ? translateJavaToJs(fullCode, inputStr) : translateCppToJs(fullCode, inputStr);
    
    // In Java mode, we already extracted the body of main, so we don't need to call Main.main()
    if (isJava && hiddenMain) {
      jsCode = jsCode.replace(/if\s*\(typeof\s+Main\s*!==\s*'undefined'\s*&&\s*Main\.main\)\s*\{\s*Main\.main\(\[\]\);\s*\}/, '');
    }

    const result = new Function(jsCode)();
    return {
      output: String(result),
      isError: false
    };
  } catch (err) {
    return {
      output: `Compilation / Execution Error: ${err.message}`,
      isError: true
    };
  }
};

const ChallengePlaygroundDialog = ({
  open,
  onClose,
  challenge,
  isDarkMode,
  onSolved
}) => {
  const starter = challenge.starterCode?.lines?.join('\n') || challenge.starterCode?.codeSnippet?.lines?.join('\n') || '';
  const [code, setCode] = useState(starter);
  const [testCaseStatuses, setTestCaseStatuses] = useState([]);
  const [activeTab, setActiveTab] = useState('problem');
  const [splitPercent, setSplitPercent] = useState(40);
  const [isConsoleOpen, setIsConsoleOpen] = useState(false);
  const [activeConsoleTab, setActiveConsoleTab] = useState('testcase');
  const [selectedTestCaseIdx, setSelectedTestCaseIdx] = useState(0);
  const [allCasesPassed, setAllCasesPassed] = useState(false);
  const [isCompiling, setIsCompiling] = useState(false);
  const isDraggingSplitRef = useRef(false);

  useEffect(() => {
    if (open) {
      setCode(starter);
      setTestCaseStatuses(challenge.testCases?.map(() => ({ status: 'idle', actual: '' })) || []);
      setActiveTab('problem');
      setIsConsoleOpen(false);
      setActiveConsoleTab('testcase');
      setSelectedTestCaseIdx(0);
      setAllCasesPassed(false);
      setIsCompiling(false);
    }
  }, [open, challenge]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (isDraggingSplitRef.current) {
        const container = document.getElementById('challenge-split-container');
        if (container) {
          const rect = container.getBoundingClientRect();
          const offset = e.clientX - rect.left;
          const newPercent = Math.max(25, Math.min(75, (offset / rect.width) * 100));
          setSplitPercent(newPercent);
        }
      }
    };

    const handleMouseUp = () => {
      if (isDraggingSplitRef.current) {
        isDraggingSplitRef.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const runTestCases = () => {
    if (isCompiling) return;
    if (!code || code.trim() === '') {
      alert("Please write some code before running.");
      return;
    }
    setIsCompiling(true);
    setIsConsoleOpen(true);
    setActiveConsoleTab('result');

    setTimeout(() => {
      const lang = challenge.starterCode?.language || challenge.language || 'cpp';
      const testCasesList = challenge.testCases || [];
      let allPassed = true;

      const newStatuses = testCasesList.map((tc) => {
        const res = simulateCodeExecution(code, tc.input || '', lang, challenge.hiddenMain);
        if (res.isError) {
          allPassed = false;
          return {
            status: 'fail',
            actual: res.output,
            isError: true
          };
        } else {
          const actual = res.output.trim().replace(/\r/g, "");
          const expected = (tc.expectedOutput || '').trim().replace(/\r/g, "");
          const pass = actual === expected;
          if (!pass) allPassed = false;
          return {
            status: pass ? 'pass' : 'fail',
            actual: res.output,
            isError: false
          };
        }
      });

      setTestCaseStatuses(newStatuses);
      setAllCasesPassed(allPassed);
      setIsCompiling(false);
    }, 700);
  };

  const handleSubmit = () => {
    if (!code || code.trim() === '') {
      alert("Please write some code before submitting.");
      return;
    }
    const lang = challenge.starterCode?.language || challenge.language || 'cpp';
    let allPassed = true;
    const testCasesList = challenge.testCases || [];
    if (testCasesList.length === 0) {
      onSolved();
      onClose();
      return;
    }

    const newStatuses = testCasesList.map((tc) => {
      const res = simulateCodeExecution(code, tc.input || '', lang, challenge.hiddenMain);
      const actual = res.output.trim().replace(/\r/g, "");
      const expected = (tc.expectedOutput || '').trim().replace(/\r/g, "");
      
      const pass = actual === expected && !res.isError;
      if (!pass) allPassed = false;
      return {
        status: pass ? 'pass' : 'fail',
        actual: res.output,
        isError: res.isError
      };
    });
    setTestCaseStatuses(newStatuses);
    setAllCasesPassed(allPassed);

    if (allPassed) {
      onSolved();
      onClose();
    } else {
      setIsConsoleOpen(true);
      setActiveConsoleTab('result');
    }
  };

  const hasUml = challenge.umlDiagram && challenge.umlDiagram.length > 0;
  const lang = challenge.starterCode?.language || challenge.language || 'cpp';

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      PaperProps={{
        style: {
          borderRadius: '24px',
          background: isDarkMode ? 'rgba(20, 20, 42, 0.98)' : 'rgba(252, 253, 255, 0.98)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          maxHeight: '95vh',
          height: '90vh',
          width: '95vw'
        }
      }}
    >
      <DialogTitle style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrophyIcon style={{ color: 'var(--primary-main)' }} />
          <Typography variant="h6" style={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif' }}>
            LeetCode Challenge Playground
          </Typography>
        </Box>
        <IconButton onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ padding: { xs: '12px', md: '20px 24px' }, overflowY: { xs: 'auto', md: 'hidden' }, overflowX: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box id="challenge-split-container" sx={{ display: 'flex', flexDirection: { xs: 'column-reverse', md: 'row' }, flexGrow: { xs: 0, md: 1 }, flexShrink: 0, height: { xs: 'auto', md: '100%' }, minHeight: { xs: 'min-content', md: '50vh' }, alignItems: 'stretch', position: 'relative', overflow: 'visible', gap: { xs: '24px', md: '0px' } }}>
          
          {/* Left Pane: Tabs (Description vs Testcases) */}
          <Box sx={{ width: { xs: '100%', md: `${splitPercent}%` }, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: { xs: 'auto', md: '200px' }, height: { xs: 'auto', md: '100%' }, overflowY: { xs: 'visible', md: 'hidden' }, paddingRight: { xs: '0px', md: '8px' } }}>
            {/* Tabs Header */}
            <Box style={{ display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '4px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', alignSelf: 'flex-start' }}>
              <button
                onClick={() => setActiveTab('problem')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'problem' ? 'var(--primary-main)' : 'transparent',
                  color: activeTab === 'problem' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease'
                }}
              >
                Problem Description
              </button>
              <button
                onClick={() => setActiveTab('testcases')}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'testcases' ? 'var(--primary-main)' : 'transparent',
                  color: activeTab === 'testcases' ? '#fff' : 'var(--text-secondary)',
                  fontSize: '0.8rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  transition: 'all 0.25s ease'
                }}
              >
                Test Cases
              </button>
            </Box>

            {/* Tab Body */}
            <Box sx={{ flexGrow: 1, overflowY: { xs: 'visible', md: 'auto' }, paddingRight: '4px' }}>
              {activeTab === 'problem' ? (
                <Box style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <Box>
                    <Box style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                      <Typography variant="h5" style={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif', color: 'var(--text-primary)' }}>
                        Coding Challenge
                      </Typography>
                      <Chip label="Medium" size="small" style={{ background: 'rgba(255, 184, 0, 0.15)', color: '#FFB800', fontWeight: 800, fontSize: '0.7rem' }} />
                    </Box>
                    <Typography variant="body2" style={{ color: 'var(--text-secondary)', whiteSpace: 'pre-line', lineHeight: 1.6, fontSize: '0.88rem' }}>
                      {challenge.problem}
                    </Typography>
                  </Box>

                  {hasUml && (
                    <Box style={{ marginTop: '4px' }}>
                      <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--primary-main)', marginBottom: '8px', fontFamily: '"Outfit", sans-serif' }}>
                        UML Class Diagram
                      </Typography>
                      <UmlDiagram data={challenge.umlDiagram[0] || challenge.umlDiagram} compact />
                    </Box>
                  )}

                  {(challenge.inputFormat || challenge.outputFormat || challenge.constraints) && (
                    <Box style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '4px' }}>
                      {challenge.inputFormat && (
                        <Box>
                          <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--primary-main)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            Input Format
                          </Typography>
                          <Typography variant="body2" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                            {challenge.inputFormat}
                          </Typography>
                        </Box>
                      )}
                      {challenge.outputFormat && (
                        <Box>
                          <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--primary-main)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            Output Format
                          </Typography>
                          <Typography variant="body2" style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                            {challenge.outputFormat}
                          </Typography>
                        </Box>
                      )}
                      {challenge.constraints && (
                        <Box>
                          <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--primary-main)', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                            Constraints
                          </Typography>
                          <Typography variant="caption" style={{ color: 'var(--text-secondary)', fontFamily: '"Roboto Mono", monospace', fontSize: '0.78rem' }}>
                            {challenge.constraints}
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {challenge.example && (
                    <Paper style={{ padding: '14px', background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)', borderRadius: '12px', border: '1px solid var(--divider)', marginTop: '4px' }}>
                      <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--success-main)', marginBottom: '8px', fontSize: '0.75rem', textTransform: 'uppercase' }}>
                        Example Case
                      </Typography>
                      <Typography variant="body2" style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: '"Roboto Mono", monospace', fontSize: '0.8rem' }}>
                        <strong>Input:</strong> {challenge.example.input}
                      </Typography>
                      <Typography variant="body2" style={{ display: 'block', color: 'var(--text-secondary)', marginBottom: '6px', fontFamily: '"Roboto Mono", monospace', fontSize: '0.8rem' }}>
                        <strong>Output:</strong> {challenge.example.output}
                      </Typography>
                      {challenge.example.explanation && (
                        <Typography variant="caption" style={{ display: 'block', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '6px', lineHeight: 1.4, fontSize: '0.78rem' }}>
                          <strong>Explanation:</strong> {challenge.example.explanation}
                        </Typography>
                      )}
                    </Paper>
                  )}
                </Box>
              ) : (
                <Box style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                    Test Cases Results
                  </Typography>
                  {(challenge.testCases || []).map((tc, idx) => {
                    const statusInfo = testCaseStatuses[idx] || { status: 'idle', actual: '' };
                    const isPass = statusInfo.status === 'pass';
                    const isFail = statusInfo.status === 'fail';

                    return (
                      <Paper key={idx} style={{ padding: '12px', borderRadius: '12px', border: `1px solid ${isPass ? '#4CAF50' : isFail ? '#ef5350' : 'rgba(255,255,255,0.06)'}`, background: 'rgba(0,0,0,0.15)' }}>
                        <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <Typography variant="caption" style={{ fontWeight: 800, color: 'var(--text-primary)' }}>
                            Test Case #{idx + 1}
                          </Typography>
                          <Chip
                            size="small"
                            label={isPass ? 'PASS' : isFail ? 'FAIL' : 'UNRUN'}
                            style={{
                              background: isPass ? 'rgba(76, 175, 80, 0.15)' : isFail ? 'rgba(239, 83, 80, 0.15)' : 'rgba(255,255,255,0.05)',
                              color: isPass ? '#66bb6a' : isFail ? '#ef5350' : 'var(--text-secondary)',
                              fontWeight: 800,
                              fontSize: '0.68rem'
                            }}
                          />
                        </Box>
                        <Typography variant="caption" style={{ display: 'block', color: 'var(--text-secondary)', fontFamily: '"Roboto Mono", monospace', marginBottom: '2px' }}>
                          <strong>Input:</strong> {tc.input || '(empty stream)'}
                        </Typography>
                        <Typography variant="caption" style={{ display: 'block', color: 'var(--text-secondary)', fontFamily: '"Roboto Mono", monospace', marginBottom: '4px' }}>
                          <strong>Expected:</strong> {tc.expectedOutput}
                        </Typography>
                        {statusInfo.actual && (
                          <Typography variant="caption" style={{ display: 'block', color: isPass ? '#4CAF50' : '#ef5350', fontFamily: '"Roboto Mono", monospace', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '4px', marginTop: '4px' }}>
                            <strong>Output:</strong> {statusInfo.actual}
                          </Typography>
                        )}
                      </Paper>
                    );
                  })}
                </Box>
              )}
            </Box>
          </Box>

          {/* Resizable Divider */}
          <Box
            onMouseDown={(e) => {
              e.preventDefault();
              isDraggingSplitRef.current = true;
              document.body.style.cursor = 'col-resize';
              document.body.style.userSelect = 'none';
            }}
            sx={{
              display: { xs: 'none', md: 'flex' },
              width: '8px',
              cursor: 'col-resize',
              backgroundColor: 'transparent',
              position: 'relative',
              zIndex: 10,
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: '-4px',
              marginRight: '-4px',
              '&:hover, &:active': {
                backgroundColor: 'var(--primary-main)',
              },
              '&::after': {
                content: '""',
                width: '2px',
                height: '40px',
                backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
                borderRadius: '1px',
              }
            }}
          />

          {/* Right Pane: Editor + Console drawer */}
          <Box sx={{ width: { xs: '100%', md: `${100 - splitPercent}%` }, display: 'flex', flexDirection: 'column', gap: '12px', minWidth: { xs: 'auto', md: '200px' }, height: { xs: '80vh', md: '100%' }, flexShrink: 0 }}>
            {/* Monaco Editor Wrapper */}
            <Box style={{
              borderRadius: '16px',
              overflow: 'hidden',
              border: isDarkMode ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
              backgroundColor: isDarkMode ? '#1e1e1e' : '#fffffe',
              boxShadow: '0 4px 25px rgba(0,0,0,0.15)',
              position: 'relative',
              flexGrow: 1,
              minHeight: 0
            }}>
              <Editor
                height="100%"
                language={lang === 'cpp' ? 'cpp' : 'java'}
                value={code}
                onChange={(val) => setCode(val || '')}
                theme={isDarkMode ? 'vs-dark' : 'light'}
                options={{
                  fontSize: 13,
                  minimap: { enabled: false },
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  padding: { top: 12, bottom: 12 },
                  lineNumbersMinChars: 3
                }}
              />
            </Box>

            {/* LeetCode-style Collapsible Console Drawer */}
            <Box style={{
              border: '1.5px solid rgba(255,255,255,0.06)',
              borderRadius: '16px',
              background: isDarkMode ? '#141418' : '#fafafa',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              height: isConsoleOpen ? '260px' : '40px',
              transition: 'height 0.2s ease-in-out'
            }}>
              {/* Header bar */}
              <Box
                style={{
                  padding: '6px 16px',
                  background: isDarkMode ? '#1e1e24' : '#eaeaea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  userSelect: 'none',
                  borderBottom: isConsoleOpen ? '1px solid rgba(255,255,255,0.05)' : 'none'
                }}
                onClick={() => setIsConsoleOpen(prev => !prev)}
              >
                <Box style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <Box style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <TerminalIcon style={{ fontSize: '0.9rem', color: 'var(--primary-main)' }} />
                    <Typography variant="caption" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Console
                    </Typography>
                  </Box>
                  
                  {isConsoleOpen && (
                    <Box style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setActiveConsoleTab('testcase')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          borderBottom: activeConsoleTab === 'testcase' ? '2px solid var(--primary-main)' : '2px solid transparent',
                          color: activeConsoleTab === 'testcase' ? (isDarkMode ? '#fff' : '#000') : 'rgba(128,128,128,0.7)',
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 800
                        }}
                      >
                        Testcases
                      </button>
                      <button
                        onClick={() => setActiveConsoleTab('result')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          borderBottom: activeConsoleTab === 'result' ? '2px solid var(--primary-main)' : '2px solid transparent',
                          color: activeConsoleTab === 'result' ? (isDarkMode ? '#fff' : '#000') : 'rgba(128,128,128,0.7)',
                          padding: '2px 8px',
                          cursor: 'pointer',
                          fontSize: '0.75rem',
                          fontWeight: 800
                        }}
                      >
                        Result
                      </button>
                    </Box>
                  )}
                </Box>
                <Typography variant="caption" style={{ color: 'var(--text-secondary)' }}>
                  {isConsoleOpen ? '▼ Minimize' : '▲ Expand'}
                </Typography>
              </Box>

              {/* Drawer Content */}
              {isConsoleOpen && (
                <Box style={{ padding: '16px', flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
                  {activeConsoleTab === 'testcase' ? (
                    <Box style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <Box style={{ display: 'flex', gap: '8px' }}>
                        {(challenge.testCases || []).map((_, idx) => (
                          <Chip
                            key={idx}
                            label={`Case ${idx + 1}`}
                            size="small"
                            onClick={() => setSelectedTestCaseIdx(idx)}
                            style={{
                              background: selectedTestCaseIdx === idx ? (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)') : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                              color: isDarkMode ? '#fff' : '#000',
                              fontWeight: selectedTestCaseIdx === idx ? 800 : 400
                            }}
                          />
                        ))}
                      </Box>
                      {challenge.testCases && challenge.testCases[selectedTestCaseIdx] && (
                        <Box style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
                          <Box>
                            <Typography variant="caption" style={{ color: 'var(--text-secondary)', fontWeight: 800, display: 'block' }}>INPUT</Typography>
                            <pre style={{ margin: '4px 0 0', padding: '8px', background: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8rem', color: isDarkMode ? '#fff' : '#000' }}>
                              {challenge.testCases[selectedTestCaseIdx].input || '(empty input)'}
                            </pre>
                          </Box>
                          <Box>
                            <Typography variant="caption" style={{ color: 'var(--text-secondary)', fontWeight: 800, display: 'block' }}>EXPECTED OUTPUT</Typography>
                            <pre style={{ margin: '4px 0 0', padding: '8px', background: isDarkMode ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)', borderRadius: '6px', fontFamily: 'monospace', fontSize: '0.8rem', color: isDarkMode ? '#fff' : '#000' }}>
                              {challenge.testCases[selectedTestCaseIdx].expectedOutput}
                            </pre>
                          </Box>
                        </Box>
                      )}
                    </Box>
                  ) : (
                    // Result Tab
                    <Box style={{ display: 'flex', flexDirection: 'column', gap: '8px', flexGrow: 1 }}>
                      {isCompiling ? (
                        <Typography variant="body2" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                          Compiling & running test cases...
                        </Typography>
                      ) : testCaseStatuses.length > 0 ? (
                        <Box style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                          <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Typography variant="subtitle2" style={{ fontWeight: 800, color: allCasesPassed ? '#4CAF50' : '#ef5350' }}>
                              {allCasesPassed ? 'Accepted ✅' : 'Wrong Answer ❌'}
                            </Typography>
                            <Typography variant="caption" style={{ color: 'var(--text-secondary)' }}>
                              ({testCaseStatuses.filter(s => s.status === 'pass').length}/{testCaseStatuses.length} cases passed)
                            </Typography>
                          </Box>

                          <Box style={{ display: 'flex', gap: '8px' }}>
                            {testCaseStatuses.map((st, idx) => (
                              <Chip
                                key={idx}
                                label={`Case ${idx + 1}`}
                                size="small"
                                onClick={() => setSelectedTestCaseIdx(idx)}
                                style={{
                                  background: selectedTestCaseIdx === idx ? (isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)') : (isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)'),
                                  color: st.status === 'pass' ? '#66bb6a' : '#ef5350',
                                  fontWeight: selectedTestCaseIdx === idx ? 800 : 400,
                                  border: `1.5px solid ${st.status === 'pass' ? 'rgba(102,187,106,0.3)' : 'rgba(239,83,80,0.3)'}`
                                }}
                              />
                            ))}
                          </Box>

                          {challenge.testCases && challenge.testCases[selectedTestCaseIdx] && (
                            <Box style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              <Typography variant="caption" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                <strong>Input:</strong> {challenge.testCases[selectedTestCaseIdx].input || '(empty)'}
                              </Typography>
                              <Typography variant="caption" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                                <strong>Expected:</strong> {challenge.testCases[selectedTestCaseIdx].expectedOutput}
                              </Typography>
                              {testCaseStatuses[selectedTestCaseIdx] && (
                                <Typography variant="caption" style={{
                                  color: testCaseStatuses[selectedTestCaseIdx].status === 'pass' ? '#66bb6a' : '#ef5350',
                                  fontFamily: 'monospace',
                                  background: isDarkMode ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.03)',
                                  padding: '6px',
                                  borderRadius: '4px',
                                  marginTop: '4px',
                                  whiteSpace: 'pre-wrap',
                                  display: 'block'
                                }}>
                                  <strong>Actual Output:</strong> {testCaseStatuses[selectedTestCaseIdx].actual}
                                </Typography>
                              )}
                            </Box>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="caption" style={{ color: 'var(--text-secondary)' }}>
                          Please run your code to see the test case results.
                        </Typography>
                      )}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>

        </Box>
      </DialogContent>

      <DialogActions style={{ padding: '12px 24px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box style={{ display: 'flex', gap: '8px' }}>
          <Button
            variant="outlined"
            size="small"
            onClick={() => setIsConsoleOpen(prev => !prev)}
            startIcon={<TerminalIcon />}
            style={{ borderRadius: '8px', textTransform: 'none', fontWeight: 800 }}
          >
            Console
          </Button>
          <Button
            variant="outlined"
            size="small"
            onClick={runTestCases}
            style={{ borderRadius: '8px', textTransform: 'none', fontWeight: 800 }}
          >
            Test Code
          </Button>
        </Box>

        <Button
          variant="contained"
          onClick={handleSubmit}
          style={{
            background: 'var(--hero-gradient)',
            color: '#fff',
            borderRadius: '10px',
            textTransform: 'none',
            fontWeight: 800,
            padding: '6px 20px',
            boxShadow: '0 4px 12px rgba(var(--primary-main-rgb), 0.2)'
          }}
        >
          Submit Solution
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { ChallengePlaygroundDialog };
