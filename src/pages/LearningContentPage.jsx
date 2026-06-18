import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import { CppPlaygroundDialog } from '../components/CppPlaygroundDialog';
import { UmlDiagram } from '../components/course/UmlDiagram';
import {
  Box,
  Button,
  Container,
  Typography,
  CircularProgress,
  LinearProgress,
  Paper,
  RadioGroup,
  FormControlLabel,
  Radio,
  TextField,
  Stack,
  useTheme,
  useMediaQuery,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Grid,
  Modal,
  Fade,
  Backdrop
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  CheckCircle as SuccessIcon,
  Cancel as CancelIcon,
  Code as CodeIcon,
  Terminal as TerminalIcon,
  Close as CloseIcon,
  MenuBook as BookIcon,
  ChevronLeft as LeftIcon,
  ChevronRight as RightIcon,
  CheckCircle as CheckCircleIcon,
  EmojiEvents as TrophyIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  PlayArrow as PlayArrowIcon,
  HelpOutline as HelpOutlineIcon
} from '@mui/icons-material';
import { loadCourseFile, normalizeCourse, findCourseByIdOrSlug } from '../utils/courseData.js';
import './LearningContentPage.css';

const parseFormattedText = (text, allowNewlines = false) => {
  if (!text) return '';
  if (typeof text !== 'string') return text;

  const parts = text.split(/(<code>[\s\S]*?<\/code>|<b>[\s\S]*?<\/b>|\\n)/g);

  return parts.map((part, index) => {
    if (!part) return null;
    if (part === '\\n') {
      return allowNewlines ? <br key={index} /> : null;
    }

    if (part.startsWith('<code>') && part.endsWith('</code>')) {
      const codeContent = part.substring(6, part.length - 7);
      return (
        <code key={index} className="slide-inline-code">
          {codeContent}
        </code>
      );
    }

    if (part.startsWith('<b>') && part.endsWith('</b>')) {
      const bContent = part.substring(3, part.length - 4);
      return (
        <b key={index}>{bContent}</b>
      );
    }

    return part;
  });
};

const highlightCppCode = (code, isDarkMode) => {
  if (!code) return '';

  const pattern = /(\/\/.*$|\/\*[\s\S]*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#(?:include|define|pragma|ifdef|endif)\b|\b(?:using|namespace|int|return|void|double|float|char|string|bool|if|else|for|while|class|struct|public|private|true|false|const|auto|long|short|switch|case|break|continue|new|delete|std|cout|cin|endl|main)\b|[{}()[\];,<>+\-*/=])/gm;
  const keywords = new Set([
    'using', 'namespace', 'int', 'return', 'void', 'double', 'float', 'char', 'string',
    'bool', 'if', 'else', 'for', 'while', 'class', 'struct', 'public', 'private',
    'true', 'false', 'const', 'auto', 'long', 'short', 'switch', 'case', 'break',
    'continue', 'new', 'delete'
  ]);
  const libraryWords = new Set(['cout', 'cin', 'std', 'endl', 'main']);

  const parts = code.split(pattern);

  return parts.map((part, idx) => {
    if (part === undefined || part === null) return null;

    let color = isDarkMode ? '#D4D4D4' : '#333333';
    let fontWeight = '400';

    if (part.startsWith('//') || part.startsWith('/*')) {
      color = isDarkMode ? '#6A9955' : '#008000';
    } else if (part.startsWith('"') || part.startsWith("'")) {
      color = isDarkMode ? '#CE9178' : '#A31515';
    } else if (part.startsWith('#') || keywords.has(part)) {
      color = isDarkMode ? '#569CD6' : '#0000FF';
      fontWeight = '600';
    } else if (libraryWords.has(part)) {
      color = isDarkMode ? '#DCDCAA' : '#795E26';
    } else if (/^\d+(?:\.\d+)?$/.test(part)) {
      color = isDarkMode ? '#B5CEA8' : '#098658';
    }

    return (
      <span key={idx} style={{ color, fontWeight }}>
        {part}
      </span>
    );
  });
};

const translateCppToJs = (cppCode, inputStr) => {
  let code = cppCode
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  const mainBodyMatch = /int\s+main\s*\(\s*\)\s*\{([\s\S]*)\}/.exec(code);
  if (!mainBodyMatch) {
    throw new Error('Missing int main() structure.');
  }
  let body = mainBodyMatch[1].trim();
  body = body.replace(/\breturn\s+0\s*;/g, '');

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

  body = body.replace(/std::cout/g, 'cout').replace(/std::cin/g, 'cin').replace(/std::endl/g, 'endl');

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

  js += '\n' + body;
  js += '\nreturn stdout.join("");';
  return js;
};

const translateJavaToJs = (javaCode, inputStr) => {
  let code = javaCode
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "");

  code = code.replace(/import\s+[\w.]+;/g, "");
  code = code.replace(/\bextends\s+Exception\b/g, 'extends Error');

  code = code.replace(/\b(?:public\s+|abstract\s+)*class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+[\w\s,]+)?/g, (match, className, parentClass) => {
    let res = `class ${className}`;
    if (parentClass) {
      res += ` extends ${parentClass}`;
    }
    return res;
  });

  code = code.replace(/\bimplements\s+[\w\s,]+/g, "");

  const classNames = [];
  let match;
  const classRegex = /class\s+(\w+)/g;
  while ((match = classRegex.exec(code)) !== null) {
    classNames.push(match[1]);
  }

  classNames.forEach(className => {
    const constrRegex = new RegExp(`\\b(?:public|private|protected|internal)?\\s*${className}\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[\\w\\s,]+)?\\s*\\{`, 'g');
    code = code.replace(constrRegex, 'constructor($1) {');
  });

  code = code.replace(/\b(public|private|protected|final|abstract|synchronized|transient|volatile)\b/g, "");

  const types = ['int', 'double', 'float', 'boolean', 'char', 'String', 'auto'];
  types.forEach(type => {
    const varDeclRegex = new RegExp(`\\b${type}(?:\\[\\])?\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\b`, 'g');
    code = code.replace(varDeclRegex, 'let $1');
  });

  types.concat(['void']).forEach(type => {
    const methodRegex = new RegExp(`\\b${type}(?:\\[\\])?\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s*\\(([^)]*)\\)\\s*(?:throws\\s+[\\w\\s,]+)?\\s*\\{`, 'g');
    code = code.replace(methodRegex, '$1($2) {');
  });

  code = code.replace(/\(([^)]*)\)/g, (match, paramStr) => {
    if (!paramStr.trim()) return '()';
    if (paramStr.includes('args') && (paramStr.includes('String') || paramStr.includes('[]'))) {
      return '(args)';
    }
    const params = paramStr.split(',').map(p => {
      const parts = p.trim().split(/\s+/);
      return parts[parts.length - 1];
    });
    return `(${params.join(', ')})`;
  });

  code = code.replace(/System\.out\.println\s*\(([^;]*)\)\s*;/g, 'stdout.push($1); stdout.push("\\n");');
  code = code.replace(/System\.out\.print\s*\(([^;]*)\)\s*;/g, 'stdout.push($1);');
  code = code.replace(/System\.out\.printf\s*\(([^;]*)\)\s*;/g, 'stdout.push(sprintf($1));');

  code = code.replace(/\be\.getMessage\(\)/g, 'e.message');
  code = code.replace(/new\s+Scanner\s*\([^)]*\)/g, 'null');
  code = code.replace(/\b[a-zA-Z0-9_]+\.(?:nextInt|nextDouble|next|nextLine)\(\)/g, 'readInput()');

  const mainRegex = /main\s*\(([^)]*)\)\s*\{([\s\S]*)\}/;
  const mainMatch = mainRegex.exec(code);
  let mainBody = '';
  if (mainMatch) {
    mainBody = mainMatch[2].trim();
    code = code.replace(mainRegex, '');
  }

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

    const sprintf = (format, ...args) => {
      let str = format;
      args.forEach(arg => {
        if (str.includes('%.2f')) {
          str = str.replace('%.2f', Number(arg).toFixed(2));
        } else if (str.includes('%.1f')) {
          str = str.replace('%.1f', Number(arg).toFixed(1));
        } else if (str.includes('%s')) {
          str = str.replace('%s', String(arg));
        } else if (str.includes('%d')) {
          str = str.replace('%d', Math.round(Number(arg)));
        } else {
          str = str.replace(/%[a-zA-Z]/, String(arg));
        }
      });
      return str;
    };
  `;

  js += '\n' + code;
  js += `\n(function() {\n${mainBody}\n})();`;
  js += '\nreturn stdout.join("");';
  return js;
};

const simulateCodeExecution = (code, inputStr = '', language = 'cpp') => {
  try {
    const isJava = language.toLowerCase() === 'java' || code.includes('class ') || code.includes('System.out');
    const jsCode = isJava ? translateJavaToJs(code, inputStr) : translateCppToJs(code, inputStr);
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

const groupIntoVisualLines = (flatLines) => {
  if (!flatLines) return [];
  const rows = [];
  let index = 0;

  while (index < flatLines.length) {
    const current = flatLines[index];
    if (current.type === 'code' && index + 1 < flatLines.length && flatLines[index + 1].type === 'input') {
      const row = [current];
      index++;
      while (index < flatLines.length && flatLines[index].type === 'input') {
        row.push(flatLines[index]);
        index++;
      }
      if (index < flatLines.length) {
        const possibleContinuation = flatLines[index];
        if (possibleContinuation.type === 'code' && possibleContinuation.content.startsWith(' ') && possibleContinuation.content.trim().length > 0) {
          row.push(possibleContinuation);
          index++;
        }
      }
      rows.push(row);
      continue;
    }
    rows.push([current]);
    index++;
  }

  return rows;
};

const getCompletedCode = (question, values = null) => {
  const visualLines = groupIntoVisualLines(question.codeTemplateLines || question.codeTemplate?.lines);
  let inputIdx = 0;

  return visualLines.map(lineGroup => {
    return lineGroup.map(part => {
      if (part.type === 'input') {
        if (values === null) {
          return part.expectedAnswer || '';
        }
        const val = values[inputIdx] !== undefined ? values[inputIdx] : '';
        inputIdx++;
        return val;
      }
      return part.content || part.content === '' ? part.content : '';
    }).join('');
  }).join('\n');
};

const getCodeTemplate = (block) => {
  const template = block?.codeTemplate || block?.raw?.codeTemplate || {};
  return {
    ...template,
    language: template.language || block?.raw?.language || block?.language || 'code',
    lines: template.lines || block?.raw?.lines || block?.lines || [],
  };
};
const getCodeLines = (block) => getCodeTemplate(block).lines || [];

const getIndentation = (visualLines, lineIdx) => {
  for (let i = lineIdx - 1; i >= 0; i--) {
    const prevLine = visualLines[i];
    if (prevLine && prevLine.length > 0 && prevLine[0].type === 'code') {
      const content = prevLine[0].content || '';
      const match = content.match(/^(\s+)/);
      if (match) {
        return match[1];
      }
    }
  }
  for (let i = lineIdx + 1; i < visualLines.length; i++) {
    const nextLine = visualLines[i];
    if (nextLine && nextLine.length > 0 && nextLine[0].type === 'code') {
      const content = nextLine[0].content || '';
      const match = content.match(/^(\s+)/);
      if (match) {
        return match[1];
      }
    }
  }
  return '';
};

const _blockKey = (page, blockIndex) => `${page.pageId || page.orderIndex}-${blockIndex}`;

const InlineMcqWidget = ({
  question,
  answers,
  correctAnswerIndex,
  codeSnippet,
  initiallyAnswered,
  initialSelectedIndex,
  onAnswered,
  isDarkMode
}) => {
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex ?? null);
  const [answered, setAnswered] = useState(initiallyAnswered);

  // Only update from props when initiallyAnswered or initialSelectedIndex actually change
  useEffect(() => {
    setSelectedIndex(initialSelectedIndex ?? null);
    if (initiallyAnswered) {
      setAnswered(true);
    }
  }, [initiallyAnswered, initialSelectedIndex]);

  const handleSelect = (idx) => {
    if (answered) return;
    setSelectedIndex(idx);
    setAnswered(true);
    onAnswered(idx, idx === correctAnswerIndex);
  };

  const isCorrect = selectedIndex === correctAnswerIndex;

  return (
    <Box className="inline-mcq-container">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Choose the Right Answer
        </Typography>
      </Box>
      <Typography variant="h6" sx={{ mb: 2.5, color: 'text.primary', lineHeight: 1.6, fontSize: '1.25rem', fontWeight: 600 }}>
        {parseFormattedText(question)}
      </Typography>

      {codeSnippet && codeSnippet.lines?.length > 0 && (
        <Paper className="slide-code-card" elevation={0} sx={{ mb: 2 }}>
          <Box className="code-card-header">
            <span>{(codeSnippet.language || 'code').toUpperCase()}</span>
          </Box>
          <Box className="code-card-body">
            <pre className="code-pre">
              {codeSnippet.lines.map((line, lIdx) => (
                <div key={lIdx} className="code-line">
                  <span className="code-line-number">{lIdx + 1}</span>
                  <span className="code-line-content">{highlightCppCode(line, isDarkMode)}</span>
                </div>
              ))}
            </pre>
          </Box>
        </Paper>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {answers.map((ans, i) => {
          const answerText = typeof ans === 'object' ? ans.answer : ans;
          const isSelected = i === selectedIndex;
          const isCorrectAnswer = i === correctAnswerIndex;

          let bgcolor = 'transparent';
          let border = '1px solid rgba(255,255,255,0.08)';
          let hoverBg = 'rgba(255,255,255,0.04)';

          if (answered) {
            if (isSelected) {
              bgcolor = isCorrect ? 'rgba(76, 175, 80, 0.2)' : 'rgba(239, 83, 80, 0.2)';
              border = isCorrect ? '2px solid #4CAF50' : '2px solid #ef5350';
              hoverBg = isCorrect ? 'rgba(76, 175, 80, 0.2)' : 'rgba(239, 83, 80, 0.2)';
            } else if (isCorrectAnswer) {
              bgcolor = 'rgba(76, 175, 80, 0.1)';
              border = '2px dashed rgba(76, 175, 80, 0.6)';
              hoverBg = 'rgba(76, 175, 80, 0.1)';
            }
          } else if (isSelected) {
            border = '2px solid var(--mui-palette-primary-main)';
          }

          return (
            <Button
              key={i}
              variant="outlined"
              onClick={() => handleSelect(i)}
              disabled={answered}
              disableRipple={answered}
              sx={{
                justifyContent: 'flex-start',
                textAlign: 'left',
                p: 2,
                backgroundColor: bgcolor,
                border,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: isSelected ? 700 : 400,
                width: '100%',
                '&:hover': {
                  backgroundColor: hoverBg,
                  border,
                },
                '&.Mui-disabled': {
                  backgroundColor: bgcolor,
                  border,
                  color: 'text.primary',
                  opacity: 1,
                },
              }}
            >
              <Box sx={{ flexGrow: 1 }}>{parseFormattedText(answerText)}</Box>
              {answered && isSelected && (
                isCorrect ? <SuccessIcon sx={{ color: '#4CAF50' }} /> : <CancelIcon sx={{ color: '#ef5350' }} />
              )}
              {answered && !isSelected && isCorrectAnswer && (
                <SuccessIcon sx={{ color: '#4CAF50', opacity: 0.6 }} />
              )}
            </Button>
          );
        })}
      </Box>

      {answered && (
        <Box sx={{ mt: 2, p: 2, borderRadius: 2, backgroundColor: isCorrect ? 'rgba(76, 175, 80, 0.08)' : 'rgba(239, 83, 80, 0.08)', border: `1px solid ${isCorrect ? 'rgba(76, 175, 80, 0.15)' : 'rgba(239, 83, 80, 0.15)'}`, display: 'flex', alignItems: 'center', gap: 1 }}>
          {isCorrect ? (
            <SuccessIcon sx={{ color: '#4CAF50', fontSize: 20 }} />
          ) : (
            <CancelIcon sx={{ color: '#ef5350', fontSize: 20 }} />
          )}
          <Typography variant="body2" sx={{ color: isCorrect ? '#4CAF50' : '#ef5350', fontWeight: 700 }}>
            {isCorrect ? 'Correct! Well done.' : 'Incorrect. Review the correct option highlighted above.'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const InlineCodeExerciseWidget = ({
  blockType,
  instruction,
  fileName,
  codeTemplate,
  testCases,
  initiallyAnswered,
  initialInputValues,
  onAnswered,
  isDarkMode
}) => {
  const [answered, setAnswered] = useState(initiallyAnswered);
  const [inputValues, setInputValues] = useState(initialInputValues || {});
  const [statuses, setStatuses] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isChecking, setIsChecking] = useState(false);

  // Only update from props when initiallyAnswered or initialInputValues actually change
  useEffect(() => {
    if (initiallyAnswered) {
      setAnswered(true);
      // Recompute statuses from saved values
      const codeLines = codeTemplate?.lines || [];
      const newStatuses = {};
      let blankIdx = 0;
      codeLines.forEach((line) => {
        if (line.type === 'input') {
          const actual = String((initialInputValues && initialInputValues[blankIdx]) || '').trim();
          const expected = String(line.expectedAnswer || '').trim();
          const normActual = actual.replace(/\s+/g, '').replace(/;+$/, '').toLowerCase();
          const normExpected = expected.replace(/\s+/g, '').replace(/;+$/, '').toLowerCase();
          newStatuses[blankIdx] = normActual === normExpected ? 'correct' : 'incorrect';
          blankIdx += 1;
        }
      });
      setStatuses(newStatuses);
      const allCorrect = Object.values(newStatuses).every(s => s === 'correct');
      setFeedbackMessage(allCorrect ? 'Correct! Well done.' : 'Incorrect. Review your answers and try again.');
    }
    if (initialInputValues) {
      setInputValues(initialInputValues);
    }
  }, [initiallyAnswered, initialInputValues]);

  const codeLines = codeTemplate?.lines || [];
  const visualRows = groupIntoVisualLines(codeLines);

  const handleInputChange = (idx, value) => {
    if (answered) return;
    setInputValues(prev => ({ ...prev, [idx]: value }));
  };

  const handleCheck = () => {
    if (isChecking) return;
    const inputLines = codeLines.filter(line => line.type === 'input');
    const hasEmptyField = inputLines.some((_, blankIdx) => {
      const value = String(inputValues[blankIdx] || '').trim();
      return value.length === 0;
    });

    if (hasEmptyField) {
      setFeedbackMessage('Please fill in all blanks before checking.');
      return;
    }

    setIsChecking(true);
    setFeedbackMessage('');

    const newStatuses = {};
    let allCorrect = true;
    let blankIdx = 0;

    codeLines.forEach((line) => {
      if (line.type === 'input') {
        const actual = String(inputValues[blankIdx] || '').trim();
        const expected = String(line.expectedAnswer || '').trim();
        const normActual = actual.replace(/\s+/g, '').replace(/;+$/, '').toLowerCase();
        const normExpected = expected.replace(/\s+/g, '').replace(/;+$/, '').toLowerCase();
        const correct = normActual === normExpected;
        newStatuses[blankIdx] = correct ? 'correct' : 'incorrect';
        if (!correct) allCorrect = false;
        blankIdx += 1;
      }
    });

    setStatuses(newStatuses);
    setAnswered(true);
    setFeedbackMessage(allCorrect ? 'Correct! Well done.' : 'Incorrect. Review your answers and try again.');
    onAnswered(allCorrect);
    setIsChecking(false);
  };

  return (
    <Box className="inline-code-exercise-container">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CodeIcon sx={{ color: 'primary.main' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'primary.main', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {blockType === 'write_line' ? 'Write the Line' : 'Fill the Code'}
          </Typography>
        </Box>
        <Chip size="small" label={codeTemplate?.language?.toUpperCase() || 'CODE'} sx={{ bgcolor: 'rgba(28,176,246,0.1)', color: '#1CB0F6', fontWeight: 800 }} />
      </Box>

      {instruction && (
        <Typography variant="body1" sx={{ mb: 2, color: 'text.primary', lineHeight: 1.6 }}>
          {parseFormattedText(instruction)}
        </Typography>
      )}

      {fileName && (
        <Typography variant="caption" sx={{ display: 'block', mb: 1, color: 'text.secondary', fontFamily: 'Roboto Mono, monospace', fontWeight: 600 }}>
          📄 {fileName}
        </Typography>
      )}

      <Box sx={{ background: 'rgba(0,0,0,0.08)', borderRadius: 3, p: 2, mb: 2, overflowX: 'auto' }}>
        <pre style={{ margin: 0 }}>
          {(() => {
            let blankIndex = 0;
            return visualRows.map((row, rowIdx) => (
              <div key={rowIdx} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', minHeight: '28px' }}>
                {row.map((item, itemIdx) => {
                  const line = item;
                  if (line.type === 'input') {
                    const currentIndex = blankIndex;
                    const value = inputValues[currentIndex] || '';
                    const status = statuses[currentIndex];
                    const width = line.width || 12;
                    blankIndex += 1;

                    if (answered) {
                      return (
                        <span key={`input-${currentIndex}`} style={{ color: status === 'correct' ? '#4CAF50' : '#ef5350', fontWeight: 800, margin: '0 6px', borderBottom: `2px solid ${status === 'correct' ? '#4CAF50' : '#ef5350'}` }}>
                          {value || line.expectedAnswer}
                        </span>
                      );
                    }

                    if (line.multiline) {
                      return (
                        <textarea
                          key={`input-${currentIndex}`}
                          value={value}
                          onChange={(event) => handleInputChange(currentIndex, event.target.value)}
                          placeholder="// type code here..."
                          disabled={answered}
                          style={{
                            width: '100%',
                            minHeight: '90px',
                            background: 'rgba(255,255,255,0.05)',
                            border: '1.5px solid rgba(255,255,255,0.12)',
                            borderRadius: '10px',
                            color: 'inherit',
                            fontFamily: 'Roboto Mono, monospace',
                            padding: '10px',
                            margin: '6px 0',
                            resize: 'vertical',
                            fontSize: '0.86rem'
                          }}
                        />
                      );
                    }

                    return (
                      <input
                        key={`input-${currentIndex}`}
                        type="text"
                        value={value}
                        onChange={(event) => handleInputChange(currentIndex, event.target.value)}
                        disabled={answered}
                        style={{
                          width: `${Math.min(Math.max(width, 4), 32) * 10 + 16}px`,
                          background: 'rgba(255,255,255,0.05)',
                          border: '1.5px solid rgba(255,255,255,0.12)',
                          borderRadius: '8px',
                          color: 'inherit',
                          fontFamily: 'Roboto Mono, monospace',
                          padding: '4px 8px',
                          margin: '0 6px',
                          fontSize: '0.86rem'
                        }}
                      />
                    );
                  }

                  return (
                    <span key={`code-${rowIdx}-${itemIdx}`} style={{ whiteSpace: 'pre' }}>
                      {highlightCppCode(line.content || '', isDarkMode)}
                    </span>
                  );
                })}
              </div>
            ));
          })()}
        </pre>
      </Box>

      {!answered ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'flex-start' }}>
          <Button variant="contained" onClick={handleCheck} disabled={isChecking} sx={{ textTransform: 'none' }}>
            {isChecking ? 'Checking...' : 'Check Answer'}
          </Button>
          {feedbackMessage && (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {feedbackMessage}
            </Typography>
          )}
        </Box>
      ) : (
        <Box sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(76,175,80,0.08)', border: '1px solid rgba(76,175,80,0.15)' }}>
          <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 700 }}>
            {feedbackMessage}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const ChallengePlaygroundDialog = ({ open, onClose, challenge, isDarkMode, onSolved }) => {
  const editorTheme = isDarkMode ? 'vs-dark' : 'light';
  const starterCode = (challenge?.starterCode?.lines || []).join('\n') || challenge?.starterCode?.codeSnippet?.lines?.join('\n') || '';
  const [code, setCode] = useState(starterCode);
  const [testCaseStatuses, setTestCaseStatuses] = useState([]);
  const [consoleLines, setConsoleLines] = useState([]);
  const [isCompiling, setIsCompiling] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCode(starterCode);
    setTestCaseStatuses((challenge?.testCases || []).map(() => ({ status: 'idle', actual: '' })));
    setConsoleLines([]);
    setIsCompiling(false);
  }, [open, starterCode, challenge]);

  const runTestCases = () => {
    if (isCompiling || !challenge) return;
    setIsCompiling(true);
    const cases = challenge.testCases || [];
    const lang = challenge.starterCode?.language || challenge.language || 'cpp';
    const newStatuses = [];
    const newConsole = [];

    cases.forEach((tc, idx) => {
      const res = simulateCodeExecution(code, tc.input || '', lang);
      const actual = res.output.trim().replace(/\r/g, '');
      const expected = String(tc.expectedOutput || '').trim().replace(/\r/g, '');
      const pass = !res.isError && actual === expected;
      newStatuses.push({ status: pass ? 'pass' : 'fail', actual, expected, error: res.isError });
      newConsole.push(`Test #${idx + 1}: ${pass ? 'PASS' : 'FAIL'}`);
      if (res.isError) {
        newConsole.push(res.output);
      } else {
        newConsole.push(`Expected: ${expected}`);
        newConsole.push(`Actual: ${actual}`);
      }
    });

    setTestCaseStatuses(newStatuses);
    setConsoleLines(newConsole);
    setIsCompiling(false);
  };

  const handleSubmit = () => {
    if (!challenge) return;
    const cases = challenge.testCases || [];
    const lang = challenge.starterCode?.language || challenge.language || 'cpp';
    const newStatuses = [];
    let allPassed = true;

    cases.forEach((tc) => {
      const res = simulateCodeExecution(code, tc.input || '', lang);
      const actual = res.output.trim().replace(/\r/g, '');
      const expected = String(tc.expectedOutput || '').trim().replace(/\r/g, '');
      const pass = !res.isError && actual === expected;
      newStatuses.push({ status: pass ? 'pass' : 'fail', actual, expected, error: res.isError });
      if (!pass) allPassed = false;
    });

    setTestCaseStatuses(newStatuses);
    if (allPassed) {
      onSolved?.();
      onClose();
    } else {
      setConsoleLines(newStatuses.flatMap((st, idx) => [`Case ${idx + 1}: ${st.status === 'pass' ? 'PASS' : 'FAIL'}`, `Expected: ${st.expected}`, `Actual: ${st.actual || 'ERROR'}`]));
    }
  };

  if (!challenge) return null;

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900 }}>
            LeetCode Challenge Playground
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>Run test cases and submit your C++ / Java solution</Typography>
        </Box>
        <IconButton onClick={onClose}><CloseIcon /></IconButton>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '0.45fr 0.55fr' }, gap: 3, minHeight: '60vh' }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Problem</Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-line', mb: 2 }}>{challenge.problem || challenge.instruction}</Typography>
          {challenge.example && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Example</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-line' }}><strong>Input:</strong> {challenge.example.input}</Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', whiteSpace: 'pre-line' }}><strong>Output:</strong> {challenge.example.output}</Typography>
              {challenge.example.explanation && (
                <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}><strong>Explanation:</strong> {challenge.example.explanation}</Typography>
              )}
            </Paper>
          )}
          {challenge.inputFormat && <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}><strong>Input Format:</strong> {challenge.inputFormat}</Typography>}
          {challenge.outputFormat && <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}><strong>Output Format:</strong> {challenge.outputFormat}</Typography>}
          {challenge.constraints && <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1 }}><strong>Constraints:</strong> {challenge.constraints}</Typography>}
          <Box sx={{ mt: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>Test Cases</Typography>
            {(challenge.testCases || []).map((tc, idx) => {
              const status = testCaseStatuses[idx]?.status || 'idle';
              return (
                <Paper key={idx} variant="outlined" sx={{ p: 2, mb: 1, borderColor: status === 'pass' ? 'success.main' : status === 'fail' ? 'error.main' : 'divider' }}>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Input:</strong> {tc.input || '(empty)'}</Typography>
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Expected:</strong> {tc.expectedOutput}</Typography>
                  {status !== 'idle' && (
                    <Typography variant="caption" sx={{ color: status === 'pass' ? 'success.main' : 'error.main', fontWeight: 700 }}>{status.toUpperCase()}</Typography>
                  )}
                </Paper>
              );
            })}
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Box sx={{ flex: 1, borderRadius: 3, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
            <Editor
              height="100%"
              theme={editorTheme}
              language={(challenge.starterCode?.language || 'cpp').toLowerCase()}
              value={code}
              onChange={(value) => setCode(value || '')}
              options={{ minimap: { enabled: false }, fontSize: 13, wordWrap: 'on' }}
            />
          </Box>
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 800 }}>Output Console</Typography>
            <Box className="challenge-console">
              {consoleLines.length > 0 ? consoleLines.map((line, idx) => (
                <p key={idx} style={{ margin: 0 }}>{line}</p>
              )) : (
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>Run or submit your code to see results.</Typography>
              )}
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="contained" onClick={runTestCases} disabled={isCompiling} startIcon={<TerminalIcon />} sx={{ textTransform: 'none' }}>
            Run Test Cases
          </Button>
          <Button variant="outlined" onClick={handleSubmit} disabled={isCompiling} sx={{ textTransform: 'none' }}>
            Submit Solution
          </Button>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>Use the editor to update code and verify results.</Typography>
      </DialogActions>
    </Dialog>
  );
};

const LearningContentPage = () => {
  const { courseId, sectionId, lessonId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('sm'));

  const [course, setCourse] = useState(location.state?.course || null);
  const [lesson, setLesson] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [answers, setAnswers] = useState({});
  const [fillCodeValues, setFillCodeValues] = useState({});
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [isChallengeOpen, setIsChallengeOpen] = useState(false);
  const [isCompilerOpen, setIsCompilerOpen] = useState(false);
  const [compilerInitialCode, setCompilerInitialCode] = useState('');
  const isComputerScience = useMemo(() => {
    return courseId?.toLowerCase()?.includes('computer-science') || String(courseId) === '2';
  }, [courseId]);

  useEffect(() => {
    const loadLesson = async () => {
      setIsLoading(true);
      try {
        let normalizedCourse = course;
        if (!normalizedCourse) {
          const rawCourses = await loadCourseFile();
          const rawCourse = findCourseByIdOrSlug(rawCourses, courseId);
          normalizedCourse = rawCourse ? normalizeCourse(rawCourse) : null;
          setCourse(normalizedCourse);
        }

        if (!normalizedCourse) {
          setLesson(null);
          setPages([]);
          return;
        }

        const section = normalizedCourse.sections?.find(s => String(s.id) === String(sectionId));
        const foundLesson = section?.lessons?.find(l => String(l.id) === String(lessonId));
        setLesson(foundLesson || null);
        setPages(foundLesson?.pages || []);
        setCurrentPageIndex(0);
        // Do NOT clear answers/fillCodeValues here — preserve them so navigating back
        // within the same lesson shows previous answers.
      } catch (err) {
        console.error('Failed to load lesson content:', err);
        setLesson(null);
        setPages([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadLesson();
  }, [courseId, sectionId, lessonId]);

  const currentPage = useMemo(() => pages[currentPageIndex] || null, [pages, currentPageIndex]);
  const progress = useMemo(() => {
    if (!pages.length) return 0;
    return Math.round(((currentPageIndex + 1) / pages.length) * 100);
  }, [pages.length, currentPageIndex]);

  const answerForBlock = (page, blockIndex) => answers[_blockKey(page, blockIndex)];

  const isInputCorrect = (input, key) => {
    if (!input || typeof input.expectedAnswer !== 'string') return false;
    const value = String(fillCodeValues[key] || '').trim();
    return value === String(input.expectedAnswer || '').trim();
  };

  const setMultipleChoiceAnswer = (page, blockIndex, answerIndex) => {
    setAnswers(prev => ({ ...prev, [_blockKey(page, blockIndex)]: answerIndex }));
  };

  const setFillCodeAnswer = (page, blockIndex, inputIndex, value) => {
    const key = `${_blockKey(page, blockIndex)}-${inputIndex}`;
    setFillCodeValues(prev => ({ ...prev, [key]: value }));
  };

  const setChallengeAnswer = (page, blockIndex, value) => {
    setAnswers(prev => ({ ...prev, [_blockKey(page, blockIndex)]: value }));
  };

  const isBlockComplete = (page, blockIndex, block) => {
    const key = _blockKey(page, blockIndex);

    if (!block || !block.type) return true;
    if (block.type === 'mcq' || block.type === 'find_error') {
      return typeof answers[key] === 'number';
    }
    if (block.type === 'fill_code' || block.type === 'write_line') {
      const inputs = getCodeLines(block).filter(line => line.type === 'input');
      return inputs.every((input, idx) => {
        const inputKey = `${key}-${idx}`;
        return String(fillCodeValues[inputKey] || '').trim().length > 0;
      });
    }
    if (block.type === 'code_challenge') {
      return answers[key] === true;
    }
    return true;
  };

  const isPageCompleted = (page) => {
    if (!page?.blocks || page.blocks.length === 0) return true;
    return page.blocks.every((block, index) => isBlockComplete(page, index, block));
  };

  const computeLessonScore = () => {
    if (!pages.length || !lesson) return 100;
    let total = 0;
    let correct = 0;

    pages.forEach((page) => {
      (page.blocks || []).forEach((block, blockIndex) => {
        const key = _blockKey(page, blockIndex);
        if (block.type === 'mcq' || block.type === 'find_error') {
          total += 1;
          if (typeof answers[key] === 'number' && answers[key] === block.correctAnswer) {
            correct += 1;
          }
        }
        if (block.type === 'fill_code' || block.type === 'write_line') {
          const inputs = getCodeLines(block).filter(line => line.type === 'input');
          if (inputs.length > 0) {
            total += 1;
            const allCorrect = inputs.every((input, idx) => isInputCorrect(input, `${key}-${idx}`));
            if (allCorrect) correct += 1;
          }
        }
        if (block.type === 'code_challenge') {
          total += 1;
          if (answers[key] === true) correct += 1;
        }
      });
    });

    return total === 0 ? 100 : Math.round((correct / total) * 100);
  };

  const handlePageChange = (delta) => {
    const nextIndex = currentPageIndex + delta;
    if (nextIndex >= 0 && nextIndex < pages.length) {
      setCurrentPageIndex(nextIndex);
      setErrorMessage('');
    }
  };

  const handleGoBack = () => navigate('/');

  const handleFinish = () => {
    if (currentPage && !isPageCompleted(currentPage)) {
      setErrorMessage('Please complete the current activity before continuing.');
      return;
    }
    const percentage = computeLessonScore();
    navigate('/', { state: { quizResult: { lessonId: lesson?.id, percentage } } });
  };

  const renderBlock = (block, page, pageIndex, blockIndex) => {
    if (!block) return null;
    const key = _blockKey(page, blockIndex);

    switch (block.type) {
      case 'heading':
        return (
          <Typography
            key={key}
            variant={block.level === 1 ? 'h4' : block.level === 2 ? 'h5' : 'h6'}
            sx={{ mt: 3, mb: 1, fontWeight: 800 }}
            dangerouslySetInnerHTML={{ __html: block.text || '' }}
          />
        );
      case 'paragraph':
        return (
          <Typography
            key={key}
            variant="body1"
            sx={{ mb: 2, whiteSpace: 'pre-line', color: 'text.secondary' }}
            dangerouslySetInnerHTML={{ __html: block.text || '' }}
          />
        );
      case 'bullet_list':
        return (
          <Box key={key} component="ul" sx={{ mb: 2, pl: 3, color: 'text.secondary' }}>
            {(block.items || []).map((item, idx) => (
              <li key={idx} style={{ marginBottom: 10 }}>
                <Typography variant="body1" component="span">
                  {item.bold ? <strong>{item.bold}</strong> : null}
                  {item.text || ''}
                </Typography>
              </li>
            ))}
          </Box>
        );
      case 'table':
        return (
          <Paper key={key} variant="outlined" sx={{ p: 2, mb: 2, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  {(block.headers || []).map((header, idx) => (
                    <th key={idx}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(block.rows || []).map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {row.map((cell, cellIdx) => (
                      <td key={cellIdx}>
                        {cell.bold ? <strong>{cell.bold}</strong> : null}
                        {cell.text || ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Paper>
        );
      case 'callout':
        return (
          <Paper key={key} variant="outlined" sx={{ p: 3, mb: 2, bgcolor: 'action.selected', borderLeft: '4px solid', borderColor: block.variant === 'warning' ? 'warning.main' : block.variant === 'success' ? 'success.main' : 'primary.main' }}>
            <Typography variant="body1" sx={{ color: 'text.secondary' }}>
              {block.text}
            </Typography>
          </Paper>
        );
      case 'image':
        return (
          <Box key={key} sx={{ mb: 3, textAlign: 'center' }}>
            {block.src ? (
              <Box
                component="img"
                src={block.src}
                alt={block.alt || 'illustration'}
                sx={{ width: '100%', maxWidth: 780, borderRadius: 4, boxShadow: 3 }}
              />
            ) : (
              <Paper sx={{ p: 4, mb: 2, bgcolor: 'background.default' }}>
                <Typography variant="body2" color="text.secondary">
                  Image preview unavailable.
                </Typography>
              </Paper>
            )}
            {block.alt && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                {block.alt}
              </Typography>
            )}
          </Box>
        );
      case 'normal_code': {
        const snippet = block.codeSnippet || block.raw?.codeSnippet || {};
        const language = snippet.language || block.raw?.language || block.language || 'code';
        const rawLines = snippet.lines || block.raw?.lines || block.lines || block.text?.split('\n') || [];
        const isCpp = language.toLowerCase() === 'cpp' || language.toLowerCase() === 'c++';
        const isRunable = block.runable !== false && (block.raw?.runable !== false);

        return (
          <Paper key={key} className="slide-code-card" elevation={0}>
            <div className="code-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CodeIcon fontSize="small" className="code-header-icon" />
                <span>{language.toUpperCase()}</span>
              </div>
              {isCpp && isComputerScience && isRunable && (
                <Button
                  size="small"
                  variant="contained"
                  startIcon={<PlayArrowIcon sx={{ fontSize: 14 }} />}
                  onClick={() => {
                    setCompilerInitialCode(rawLines.join('\n'));
                    setIsCompilerOpen(true);
                  }}
                  style={{
                    padding: '3px 10px',
                    borderRadius: '8px',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    textTransform: 'none',
                    background: 'var(--hero-gradient)',
                    color: '#fff',
                    boxShadow: '0 4px 10px rgba(var(--primary-main-rgb), 0.2)'
                  }}
                >
                  Run Code
                </Button>
              )}
            </div>
            <div className="code-card-body">
              <pre className="code-pre">
                {rawLines.map((line, lIdx) => (
                  <div key={lIdx} className="code-line">
                    <span className="code-line-number">{lIdx + 1}</span>
                    <span className="code-line-content">{highlightCppCode(line, theme.palette.mode === 'dark')}</span>
                  </div>
                ))}
              </pre>
            </div>
          </Paper>
        );
      }
      case 'mcq':
      case 'find_error':
        return (
          <InlineMcqWidget
            key={key}
            question={block.question || block.instruction || ''}
            answers={block.answers || []}
            correctAnswerIndex={block.correctAnswer}
            codeSnippet={block.codeSnippet}
            initiallyAnswered={typeof answers[key] === 'number'}
            initialSelectedIndex={typeof answers[key] === 'number' ? answers[key] : null}
            onAnswered={(selectedIndex) => setMultipleChoiceAnswer(page, blockIndex, selectedIndex)}
            isDarkMode={theme.palette.mode === 'dark'}
          />
        );
      case 'fill_code':
      case 'write_line': {
        const codeLines = getCodeLines(block);
        const inputCount = codeLines.filter(line => line.type === 'input').length;
        const savedValues = {};
        let hasSavedValues = false;
        for (let i = 0; i < inputCount; i++) {
          const inputKey = `${key}-${i}`;
          if (fillCodeValues[inputKey] !== undefined) {
            savedValues[i] = fillCodeValues[inputKey];
            hasSavedValues = true;
          }
        }
        const wasAnswered = hasSavedValues && Object.keys(savedValues).length === inputCount;
        return (
          <InlineCodeExerciseWidget
            key={key}
            blockType={block.type}
            instruction={block.instruction || ''}
            fileName={block.fileName}
            codeTemplate={getCodeTemplate(block)}
            testCases={block.testCases || []}
            initiallyAnswered={wasAnswered}
            initialInputValues={wasAnswered ? savedValues : null}
            onAnswered={(passed) => setChallengeAnswer(page, blockIndex, passed)}
            isDarkMode={theme.palette.mode === 'dark'}
          />
        );
      }
      case 'code_challenge':
        return (
          <Paper key={key} variant="outlined" sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>
              Coding Challenge
            </Typography>
            <Typography variant="body1" sx={{ mb: 2, color: 'text.secondary', whiteSpace: 'pre-line' }}>
              {block.problem || block.instruction || 'Solve the challenge below.'}
            </Typography>
            {(block.example || block.inputFormat || block.outputFormat || block.constraints) && (
              <Box sx={{ mb: 2, display: 'grid', gap: 1 }}>
                {block.inputFormat && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Input Format:</strong> {block.inputFormat}</Typography>
                )}
                {block.outputFormat && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Output Format:</strong> {block.outputFormat}</Typography>
                )}
                {block.constraints && (
                  <Typography variant="body2" sx={{ color: 'text.secondary' }}><strong>Constraints:</strong> {block.constraints}</Typography>
                )}
              </Box>
            )}
            <Button
              variant="contained"
              onClick={() => {
                setSelectedChallenge(block);
                setIsChallengeOpen(true);
              }}
              sx={{ textTransform: 'none' }}
            >
              Open Challenge Playground
            </Button>
            {answers[key] === true && (
              <Typography variant="body2" sx={{ mt: 1, color: 'success.main', fontWeight: 700 }}>
                ✔ Challenge solved.
              </Typography>
            )}
          </Paper>
        );
      case 'uml_diagram':
        return (
          <Paper key={key} variant="outlined" sx={{ p: 3, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700 }}>
              UML Diagram
            </Typography>
            <UmlDiagram
              data={{
                title: block.title,
                attributes: block.attributes || block.Attributes || [],
                methods: block.methods || block.Methods || []
              }}
              compact
            />
          </Paper>
        );
      default:
        return (
          <Box key={key} sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              {block.text || JSON.stringify(block)}
            </Typography>
          </Box>
        );
    }
  };

  if (isLoading) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 3 }}>Loading lesson...</Typography>
      </Container>
    );
  }

  if (!course || !lesson) {
    return (
      <Container maxWidth="md" sx={{ py: 8, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Lesson not found</Typography>
        <Typography variant="body1" sx={{ mb: 3 }}>We could not locate that lesson in the course data.</Typography>
        <Button variant="contained" onClick={handleGoBack} startIcon={<ArrowBackIcon />}>Back to Roadmap</Button>
      </Container>
    );
  }

  return (
    <Box className="learning-content-page">
      <header className="learning-content-header glass-panel">
        <Container maxWidth="lg" className="learning-header-content">
          <div className="learning-header-left">
            <IconButton onClick={() => navigate(-1)} className="learning-back-btn">
              <ArrowBackIcon />
            </IconButton>
            <div>
              <Typography variant="h6" className="learning-lesson-title">
                {lesson.title}
              </Typography>
              <Typography variant="caption" className="learning-progress-text">
                Slide {currentPageIndex + 1} of {pages.length}
              </Typography>
            </div>
          </div>
          <IconButton onClick={() => {
            const originalCourseId = location.state?.course?.id || courseId;
            navigate(`/learning-path/${originalCourseId}`, { state: location.state });
          }} className="learning-close-btn">
            <CloseIcon />
          </IconButton>
        </Container>
        <LinearProgress
          variant="determinate"
          value={progress}
          className="learning-progress-bar"
        />
      </header>

      <Container maxWidth="md" className="learning-slide-deck">
        {currentPage && (
          <Box className="learning-slide-container">
            <Paper className="learning-slide-paper glass-panel-strong" elevation={0}>
              {currentPage.pageTitle && (
                <Typography variant="h4" className="slide-page-title" gutterBottom>
                  {currentPage.pageTitle}
                </Typography>
              )}
              <div className="slide-blocks-list">
                {currentPage.blocks?.map((block, idx) => renderBlock(block, currentPage, currentPageIndex, idx))}
              </div>
            </Paper>
          </Box>
        )}
      </Container>

      <footer className="learning-content-footer glass-panel">
        <Container maxWidth="md" className="learning-footer-content">
          <Button
            variant="outlined"
            onClick={() => handlePageChange(-1)}
            disabled={currentPageIndex === 0}
            startIcon={<ArrowBackIcon />}
            className="footer-nav-btn"
          >
            Previous
          </Button>
          <Button
            variant="contained"
            onClick={currentPageIndex === pages.length - 1 ? handleFinish : () => handlePageChange(1)}
            endIcon={currentPageIndex === pages.length - 1 ? undefined : <ArrowForwardIcon />}
            className="footer-nav-btn primary"
          >
            {currentPageIndex === pages.length - 1 ? 'Finish Lesson' : 'Next'}
          </Button>
        </Container>
      </footer>

      <CppPlaygroundDialog
        open={isCompilerOpen}
        onClose={() => setIsCompilerOpen(false)}
        initialCode={compilerInitialCode}
      />
      <ChallengePlaygroundDialog
        open={isChallengeOpen}
        onClose={() => setIsChallengeOpen(false)}
        challenge={selectedChallenge}
        isDarkMode={theme.palette.mode === 'dark'}
        onSolved={() => {
          if (!selectedChallenge) return;
          const pageKey = _blockKey(currentPage, currentPage.blocks.findIndex(b => b === selectedChallenge));
          setAnswers(prev => ({ ...prev, [pageKey]: true }));
        }}
      />
    </Box>
  );
};

export default LearningContentPage;