import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { UmlDiagram } from '../components/course/UmlDiagram';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  LinearProgress,
  IconButton,
  useTheme,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Close as CloseIcon,
  MenuBook as BookIcon,
  ChevronLeft as LeftIcon,
  ChevronRight as RightIcon,
  CheckCircle as SuccessIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  Code as CodeIcon,
  PlayArrow as PlayArrowIcon,
  HelpOutline as HelpOutlineIcon,
  Cancel as CancelIcon,
  EmojiEvents as TrophyIcon,
  Terminal as TerminalIcon,
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { getLessonById } from '../data/courses';
import { CppPlaygroundDialog } from '../components/CppPlaygroundDialog';
import { JavaOopUmlPlayground } from '../components/JavaOopUmlPlayground';
import { ChallengePlaygroundDialog } from '../components/ChallengePlaygroundDialog';
import './LearningContentPage.css';

const STORAGE_KEY = 'sophia_learning_progress';

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveProgress(progress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

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
      return <code key={index} className="slide-inline-code">{codeContent}</code>;
    }
    if (part.startsWith('<b>') && part.endsWith('</b>')) {
      const bContent = part.substring(3, part.length - 4);
      return <b key={index}>{bContent}</b>;
    }
    return part;
  });
};

const highlightCppCode = (code, isDarkMode) => {
  if (!code) return '';
  const keywords = new Set([
    'using', 'namespace', 'int', 'return', 'void', 'double', 'float', 'char', 'string',
    'bool', 'if', 'else', 'for', 'while', 'class', 'struct', 'public', 'private',
    'true', 'false', 'const', 'auto', 'long', 'short', 'switch', 'case', 'break',
    'continue', 'new', 'delete'
  ]);
  const libraryWords = new Set(['cout', 'cin', 'std', 'endl', 'main']);
  const pattern = /(\/\/.*$|\/\*.*?\*\/|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|#(?:include|define|pragma|ifdef|endif)\b|\b(?:using|namespace|int|return|void|double|float|char|string|bool|if|else|for|while|class|struct|public|private|true|false|const|auto|long|short|switch|case|break|continue|new|delete|std|cout|cin|endl|main)\b|[{}()[\];,<>+\-*/=])/g;
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
    return <span key={idx} style={{ color, fontWeight }}>{part}</span>;
  });
};

const _blockKey = (pageIdx, blockIdx) => `${pageIdx}_${blockIdx}`;

// Inline MCQ Widget
const InlineMcqWidget = ({
  question, answers, correctAnswerIndex, codeSnippet,
  initiallyAnswered, initialSelectedIndex, onAnswered, isDarkMode
}) => {
  const [selectedIndex, setSelectedIndex] = useState(initialSelectedIndex !== undefined ? initialSelectedIndex : null);
  const [answered, setAnswered] = useState(initiallyAnswered);

  useEffect(() => {
    setAnswered(initiallyAnswered);
    if (initialSelectedIndex !== undefined) {
      setSelectedIndex(initialSelectedIndex);
    } else {
      setSelectedIndex(null);
    }
  }, [initiallyAnswered, initialSelectedIndex]);

  const handleSelect = (idx) => {
    if (answered) return;
    setSelectedIndex(idx);
    setAnswered(true);
    const isCorrect = idx === correctAnswerIndex;
    onAnswered(idx, isCorrect);
  };

  const isCorrect = selectedIndex === correctAnswerIndex;

  return (
    <Box className="inline-mcq-container glass-panel-strong" style={{ padding: '24px', margin: '20px 0', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', background: 'rgba(255,255,255,0.02)' }}>
      <Box style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <HelpOutlineIcon style={{ color: 'var(--primary-main)' }} />
        <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--primary-main)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Choose the Right Answer
        </Typography>
      </Box>
      <Typography variant="body1" style={{ fontWeight: 650, marginBottom: '16px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
        {parseFormattedText(question)}
      </Typography>

      {codeSnippet && codeSnippet.lines && codeSnippet.lines.length > 0 && (
        <Paper className="slide-code-card" elevation={0} style={{ marginBottom: '18px', background: 'rgba(0,0,0,0.2)' }}>
          <div className="code-card-header" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span>{codeSnippet.language?.toUpperCase() || 'CODE'}</span>
          </div>
          <div className="code-card-body" style={{ padding: '12px' }}>
            <pre className="code-pre" style={{ margin: 0 }}>
              {codeSnippet.lines.map((line, lIdx) => (
                <div key={lIdx} className="code-line" style={{ display: 'flex' }}>
                  <span className="code-line-number" style={{ width: '25px', opacity: 0.4 }}>{lIdx + 1}</span>
                  <span className="code-line-content">{highlightCppCode(line, isDarkMode)}</span>
                </div>
              ))}
            </pre>
          </div>
        </Paper>
      )}

      <Box style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {answers.map((ans, i) => {
          const answerText = typeof ans === 'object' ? ans.answer : ans;
          const isSelected = i === selectedIndex;
          const isCorrectAnswer = i === correctAnswerIndex;
          let btnBg = 'rgba(255,255,255,0.03)';
          let btnBorder = '1px solid rgba(255,255,255,0.06)';
          if (answered) {
            if (isSelected) {
              btnBg = isCorrect ? 'rgba(76, 175, 80, 0.12)' : 'rgba(239, 83, 80, 0.12)';
              btnBorder = isCorrect ? '1.5px solid #4CAF50' : '1.5px solid #ef5350';
            } else if (isCorrectAnswer) {
              btnBg = 'rgba(76, 175, 80, 0.06)';
              btnBorder = '1.5px dashed rgba(76, 175, 80, 0.5)';
            }
          }
          return (
            <Button key={i} onClick={() => handleSelect(i)} disabled={answered}
              style={{
                justifyContent: 'flex-start', textAlign: 'left', padding: '14px 18px',
                background: btnBg, border: btnBorder, borderRadius: '12px',
                color: 'var(--text-primary)', textTransform: 'none',
                width: '100%', fontWeight: isSelected ? 700 : 400
              }}>
              <span style={{ flexGrow: 1, fontSize: '0.92rem' }}>{parseFormattedText(answerText)}</span>
              {answered && isSelected && (isCorrect ? <SuccessIcon style={{ color: '#4CAF50' }} /> : <CancelIcon style={{ color: '#ef5350' }} />)}
              {answered && !isSelected && isCorrectAnswer && <SuccessIcon style={{ color: '#4CAF50', opacity: 0.6 }} />}
            </Button>
          );
        })}
      </Box>

      {answered && (
        <Box style={{
          marginTop: '18px', padding: '14px 16px', borderRadius: '12px',
          backgroundColor: isCorrect ? 'rgba(76, 175, 80, 0.08)' : 'rgba(239, 83, 80, 0.08)',
          border: `1px solid ${isCorrect ? 'rgba(76, 175, 80, 0.15)' : 'rgba(239, 83, 80, 0.15)'}`,
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          {isCorrect ? <SuccessIcon style={{ color: '#4CAF50', fontSize: '20px' }} /> : <ErrorIcon style={{ color: '#ef5350', fontSize: '20px' }} />}
          <Typography variant="body2" style={{ color: isCorrect ? '#4CAF50' : '#ef5350', fontWeight: 700 }}>
            {isCorrect ? 'Correct! Well done.' : 'Incorrect. Review the correct option highlighted above.'}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

// Inline Code Exercise Widget
const InlineCodeExerciseWidget = ({
  blockType, instruction, fileName, codeLines, language,
  initiallyAnswered, initialInputValues, onAnswered, isDarkMode
}) => {
  const [answered, setAnswered] = useState(initiallyAnswered);
  const [inputValues, setInputValues] = useState(initialInputValues || {});
  const [statuses, setStatuses] = useState({});
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [lastAnswerCorrect, setLastAnswerCorrect] = useState(false);
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    setAnswered(initiallyAnswered);
    if (initialInputValues) setInputValues(initialInputValues);
  }, [initiallyAnswered, initialInputValues]);

  const visualRows = [];
  let i = 0;
  while (i < codeLines.length) {
    const line = codeLines[i];
    if (line.sameLine && visualRows.length > 0) {
      visualRows[visualRows.length - 1].push({ line, idx: i });
    } else {
      visualRows.push([{ line, idx: i }]);
    }
    i++;
  }

  const handleInputChange = (idx, value) => {
    if (answered) return;
    setValidationError('');
    setInputValues(prev => ({ ...prev, [idx]: value }));
  };

  const handleCheck = () => {
    const hasEmptyField = codeLines.some((line, idx) => {
      if (line.type === 'input') {
        const val = inputValues[idx];
        return !val || val.trim() === '';
      }
      return false;
    });
    if (hasEmptyField) {
      setValidationError('Please fill in all blanks before checking.');
      return;
    }

    let allCorrect = true;
    const newStatuses = {};
    codeLines.forEach((line, idx) => {
      if (line.type === 'input') {
        const expected = (line.expectedAnswer || '').trim().toLowerCase();
        const actual = (inputValues[idx] || '').trim().toLowerCase();
        const normExpected = expected.replace(/\s+/g, '').replace(/;+$/, '');
        const normActual = actual.replace(/\s+/g, '').replace(/;+$/, '');
        if (normActual === normExpected) {
          newStatuses[idx] = 'correct';
        } else {
          newStatuses[idx] = 'incorrect';
          allCorrect = false;
        }
      }
    });

    setStatuses(newStatuses);
    setLastAnswerCorrect(allCorrect);
    setAnswered(true);
    setFeedbackMessage(allCorrect ? 'Correct! Well done.' : 'Incorrect. Review your answers and try again.');
    onAnswered(allCorrect);
  };

  return (
    <Box className="inline-code-exercise-container glass-panel-strong" style={{ padding: '24px', margin: '20px 0', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', background: 'rgba(255,255,255,0.02)' }}>
      <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <Box style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CodeIcon style={{ color: 'var(--primary-main)' }} />
          <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--primary-main)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {blockType === 'write_line' ? 'Write the Line' : 'Fill the Code'}
          </Typography>
        </Box>
        <Chip size="small" label={language.toUpperCase()} style={{ background: 'rgba(28,176,246,0.1)', color: '#1CB0F6', fontWeight: 800 }} />
      </Box>

      {instruction && (
        <Typography variant="body1" style={{ marginBottom: '16px', color: 'var(--text-primary)', lineHeight: 1.5 }}>
          {parseFormattedText(instruction)}
        </Typography>
      )}

      {fileName && (
        <Typography variant="caption" style={{ display: 'block', marginBottom: '10px', color: 'var(--text-secondary)', fontFamily: '"Roboto Mono", monospace', fontWeight: 600 }}>
          📄 {fileName}
        </Typography>
      )}

      <Box style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '14px', padding: '18px', marginBottom: '18px', overflowX: 'auto' }}>
        <pre style={{ margin: 0, fontFamily: '"Roboto Mono", monospace', fontSize: '0.85rem', color: 'var(--code-text-default)', lineHeight: 1.7 }}>
          {visualRows.map((row, rowIdx) => (
            <div key={rowIdx} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', minHeight: '28px' }}>
              {row.map(({ line, idx }) => {
                if (line.type === 'input') {
                  const val = inputValues[idx] || '';
                  const status = statuses[idx];
                  const widthCh = line.width || 12;
                  if (answered) {
                    const isInputCorrect = status === 'correct' || lastAnswerCorrect;
                    return (
                      <span key={idx} style={{ color: isInputCorrect ? '#4CAF50' : '#ef5350', fontWeight: 800, margin: '0 6px', borderBottom: `2.5px solid ${isInputCorrect ? '#4CAF50' : '#ef5350'}` }}>
                        {val || line.expectedAnswer}
                      </span>
                    );
                  }
                  if (line.multiline) {
                    return (
                      <textarea key={idx} value={val}
                        onChange={(e) => handleInputChange(idx, e.target.value)}
                        placeholder="// type code here..."
                        style={{ width: '100%', minHeight: '90px', background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff', fontFamily: '"Roboto Mono", monospace', padding: '10px', marginTop: '6px', marginBottom: '6px', resize: 'vertical', fontSize: '0.82rem' }}
                      />
                    );
                  }
                  return (
                    <input key={idx} type="text" value={val}
                      onChange={(e) => handleInputChange(idx, e.target.value)}
                      style={{ width: `${widthCh * 8 + 35}px`, background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff', fontFamily: '"Roboto Mono", monospace', padding: '3px 8px', margin: '0 6px', fontSize: '0.82rem' }}
                    />
                  );
                }
                return <span key={idx} style={{ whiteSpace: 'pre' }}>{highlightCppCode(line.content, isDarkMode)}</span>;
              })}
            </div>
          ))}
        </pre>
      </Box>

      {!answered ? (
        <Box style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
          <Button variant="contained" onClick={handleCheck}
            style={{ background: 'var(--hero-gradient)', color: '#fff', borderRadius: '12px', textTransform: 'none', fontWeight: 800, padding: '10px 24px' }}>
            Check Answer
          </Button>
          {validationError && <Typography variant="body2" style={{ color: '#ef5350', fontWeight: 600, marginTop: '4px' }}>{validationError}</Typography>}
        </Box>
      ) : (
        <Box style={{
          padding: '14px 16px', borderRadius: '12px',
          backgroundColor: lastAnswerCorrect ? 'rgba(76, 175, 80, 0.08)' : 'rgba(239, 83, 80, 0.08)',
          border: `1px solid ${lastAnswerCorrect ? 'rgba(76, 175, 80, 0.15)' : 'rgba(239, 83, 80, 0.15)'}`,
          display: 'flex', alignItems: 'center', gap: '10px'
        }}>
          {lastAnswerCorrect ? <SuccessIcon style={{ color: '#4CAF50', fontSize: '20px' }} /> : <ErrorIcon style={{ color: '#ef5350', fontSize: '20px' }} />}
          <Typography variant="body2" style={{ color: lastAnswerCorrect ? '#4CAF50' : '#ef5350', fontWeight: 700, lineHeight: 1.4 }}>
            {feedbackMessage}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

const LearningContentPage = () => {
  const { courseId, sectionId, lessonId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === 'dark';

  const [lesson, setLesson] = useState(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [completionSaved, setCompletionSaved] = useState(false);
  const [exerciseAnswers, setExerciseAnswers] = useState({});
  const [blockSelectedIndex, setBlockSelectedIndex] = useState({});
  const [blankValues, setBlankValues] = useState({});
  const [progress, setProgress] = useState(loadProgress());

  // Playground dialog state
  const [cppPlaygroundOpen, setCppPlaygroundOpen] = useState(false);
  const [javaPlaygroundOpen, setJavaPlaygroundOpen] = useState(false);
  const [playgroundCode, setPlaygroundCode] = useState('');

  // Code challenge state
  const [isChallengeOpen, setIsChallengeOpen] = useState(false);
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [selectedChallengeBlockIdx, setSelectedChallengeBlockIdx] = useState(null);

  // Interactive states
  const [activeCardId, setActiveCardId] = useState(null);
  const [activeDetail, setActiveDetail] = useState('');
  const [activeTab, setActiveTab] = useState(0);

  // Grade dialog state
  const [showGradeDialog, setShowGradeDialog] = useState(false);
  const [gradeInfo, setGradeInfo] = useState(null);

  // Reset interactive states when page changes
  useEffect(() => {
    setActiveCardId(null);
    setActiveDetail('');
    setActiveTab(0);
  }, [currentPageIndex]);

  // Load lesson from info.csv
  useEffect(() => {
    const loadLessonContent = async () => {
      setIsLoading(true);
      try {
        const data = await getLessonById(courseId, sectionId, lessonId);
        if (data) {
          setLesson(data);
        }
      } catch (err) {
        console.warn('Failed to load lesson:', err);
      } finally {
        setIsLoading(false);
      }
    };
    loadLessonContent();
  }, [courseId, sectionId, lessonId]);

  const hasPages = lesson && lesson.pages && lesson.pages.length > 0;
  const pages = lesson?.pages || [];
  const currentPage = hasPages ? pages[currentPageIndex] : null;
  const progressPercent = hasPages ? ((currentPageIndex + 1) / pages.length) * 100 : 0;

  const isPageCompleted = (pageIdx) => {
    const page = pages[pageIdx];
    if (!page || !page.blocks) return true;
    for (let idx = 0; idx < page.blocks.length; idx++) {
      const block = page.blocks[idx];
      if (['mcq', 'fill_code', 'write_line', 'find_error', 'code_challenge'].includes(block.type)) {
        const key = _blockKey(pageIdx, idx);
        if (exerciseAnswers[key] === undefined) return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (currentPageIndex < pages.length - 1) {
      setCurrentPageIndex(prev => prev + 1);
    } else {
      handleFinish();
    }
  };

  const handlePrevious = () => {
    if (currentPageIndex > 0) {
      setCurrentPageIndex(prev => prev - 1);
    }
  };

  const handleFinish = () => {
    if (completionSaved) {
       navigate(`/course/${courseId}/${sectionId}`, { state: { returnedFromLessonId: lessonId } });
       return;
    }
    
    if (lesson?.id) {
      setCompletionSaved(true);
      let grade = 100;
      let totalQuestions = 0;
      let correctQuestions = 0;
      let totalPts = 0;
      let earnedPts = 0;

      pages.forEach((page, pageIdx) => {
        if (page.blocks) {
          page.blocks.forEach((block, blockIdx) => {
            if (['mcq', 'fill_code', 'write_line', 'find_error', 'code_challenge'].includes(block.type)) {
              totalQuestions++;
              const pts = block.type === 'code_challenge' ? 3 : 1;
              totalPts += pts;
              
              const key = _blockKey(pageIdx, blockIdx);
              if (exerciseAnswers[key] === true) {
                correctQuestions++;
                earnedPts += pts;
              }
            }
          });
        }
      });

      if (totalPts > 0) grade = Math.round((earnedPts / totalPts) * 100);

      const updatedProgress = { ...progress, [lesson.id]: grade };
      saveProgress(updatedProgress);
      setProgress(updatedProgress);

      if (totalQuestions > 0) {
        setGradeInfo({
          grade,
          totalQuestions,
          correctQuestions,
          totalPts,
          earnedPts
        });
        setShowGradeDialog(true);
      } else {
        navigate(`/course/${courseId}/${sectionId}`, { state: { returnedFromLessonId: lessonId } });
      }
    } else {
      navigate(`/course/${courseId}/${sectionId}`, { state: { returnedFromLessonId: lessonId } });
    }
  };

  const handleOpenCppPlayground = (codeBlock) => {
    setPlaygroundCode(codeBlock);
    setCppPlaygroundOpen(true);
  };

  const handleOpenJavaPlayground = (codeBlock) => {
    setPlaygroundCode(codeBlock);
    setJavaPlaygroundOpen(true);
  };

  const renderBlock = (block, idx) => {
    switch (block.type) {
      case 'uml_diagram':
        return <UmlDiagram key={idx} data={block.raw || block} />;

      case 'mcq':
      case 'find_error': {
        const questionText = block.question || block.instruction || block.text || '';
        const answers = block.answers || block.raw?.answers || [];
        const correctAnswer = block.correctAnswer !== undefined ? block.correctAnswer : (block.correctAnswerIndex !== undefined ? block.correctAnswerIndex : (block.raw?.correctAnswer !== undefined ? block.raw.correctAnswer : 0));
        const codeSnippet = block.codeSnippet || block.raw?.codeSnippet || null;
        const key = _blockKey(currentPageIndex, idx);
        return (
          <InlineMcqWidget key={idx} question={questionText} answers={answers}
            correctAnswerIndex={correctAnswer} codeSnippet={codeSnippet}
            initiallyAnswered={exerciseAnswers[key] !== undefined}
            initialSelectedIndex={blockSelectedIndex[key]}
            isDarkMode={isDarkMode}
            onAnswered={(selectedIdx, isCorrect) => {
              setBlockSelectedIndex(prev => ({ ...prev, [key]: selectedIdx }));
              setExerciseAnswers(prev => ({ ...prev, [key]: isCorrect }));
            }}
          />
        );
      }

      case 'fill_code':
      case 'write_line': {
        const key = _blockKey(currentPageIndex, idx);
        const instruction = block.instruction || block.raw?.instruction || '';
        const fileName = block.fileName || block.raw?.fileName || '';
        const template = block.codeTemplate || block.raw?.codeTemplate || {};
        const codeLines = template.lines || [];
        const language = template.language || block.language || block.raw?.language || 'cpp';
        return (
          <InlineCodeExerciseWidget key={idx} blockType={block.type}
            instruction={instruction} fileName={fileName}
            codeLines={codeLines} language={language}
            initiallyAnswered={exerciseAnswers[key] !== undefined}
            initialInputValues={blankValues[key]}
            isDarkMode={isDarkMode}
            onAnswered={(isCorrect) => setExerciseAnswers(prev => ({ ...prev, [key]: isCorrect }))}
          />
        );
      }

      case 'code_challenge': {
        const key = _blockKey(currentPageIndex, idx);
        const isSolved = exerciseAnswers[key] === true;
        const isSkipped = exerciseAnswers[key] === false;
        
        return (
          <Box key={idx} className="code-challenge-block glass-panel" style={{ padding: '20px 24px', margin: '20px 0', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '16px', background: 'rgba(255,255,255,0.02)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '10px', background: isSolved ? 'rgba(76, 175, 80, 0.1)' : isSkipped ? 'rgba(158, 158, 158, 0.1)' : 'rgba(28, 176, 246, 0.1)' }}>
                <TrophyIcon style={{ color: isSolved ? '#4CAF50' : isSkipped ? '#9e9e9e' : 'var(--primary-main)' }} />
              </Box>
              <Box>
                <Typography variant="subtitle1" style={{ fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>Code Challenge</Typography>
                {isSolved ? (
                  <Typography variant="caption" style={{ color: '#4CAF50', fontWeight: 700 }}>Completed ✅</Typography>
                ) : isSkipped ? (
                  <Typography variant="caption" style={{ color: '#9e9e9e', fontWeight: 700 }}>Skipped ⏭</Typography>
                ) : (
                  <Typography variant="caption" style={{ color: 'var(--text-secondary)' }}>Test your skills</Typography>
                )}
              </Box>
            </Box>
            <Box style={{ display: 'flex', gap: '12px' }}>
              {(!isSolved && !isSkipped) && (
                <Button
                  variant="outlined"
                  onClick={() => setExerciseAnswers(prev => ({ ...prev, [key]: false }))}
                  style={{
                    borderColor: 'rgba(255,255,255,0.2)',
                    color: 'var(--text-secondary)',
                    borderRadius: '12px',
                    textTransform: 'none',
                    fontWeight: 700,
                    padding: '8px 16px',
                  }}
                >
                  Skip
                </Button>
              )}
              <Button
                variant="contained"
                onClick={() => {
                  setSelectedChallenge(block.raw || block);
                  setSelectedChallengeBlockIdx(idx);
                  setIsChallengeOpen(true);
                }}
                style={{
                  background: isSolved ? 'rgba(76, 175, 80, 0.12)' : isSkipped ? 'rgba(158, 158, 158, 0.12)' : 'var(--hero-gradient)',
                  color: isSolved ? '#4CAF50' : isSkipped ? '#9e9e9e' : '#fff',
                  border: isSolved ? '1.5px solid #4CAF50' : isSkipped ? '1.5px solid #9e9e9e' : 'none',
                  borderRadius: '12px',
                  textTransform: 'none',
                  fontWeight: 800,
                  padding: '8px 20px',
                  boxShadow: (isSolved || isSkipped) ? 'none' : '0 4px 14px rgba(28, 176, 246, 0.3)'
                }}
              >
                {isSolved ? 'Retake Challenge' : isSkipped ? 'Try Challenge' : 'Solve Challenge'}
              </Button>
            </Box>
          </Box>
        );
      }

      case 'heading': {
        const level = block.level || 1;
        const variant = level === 1 ? 'h4' : level === 2 ? 'h5' : 'h6';
        return <Typography key={idx} variant={variant} className={`slide-heading slide-h${level}`} gutterBottom>
          {parseFormattedText(block.text, true)}
        </Typography>;
      }

      case 'paragraph':
        return <Typography key={idx} variant="body1" className="slide-paragraph">
          {parseFormattedText(block.text)}
        </Typography>;

      case 'bullet_list':
        return (
          <ul key={idx} className="slide-bullet-list">
            {block.items?.map((item, i) => (
              <li key={i} className="slide-bullet-item">
                {item.bold && <strong className="slide-bullet-bold">{item.bold}</strong>}
                <span className="slide-bullet-text">{parseFormattedText(item.text)}</span>
              </li>
            ))}
          </ul>
        );

      case 'callout': {
        const variant = block.variant || 'info';
        const icon =
          variant === 'warning' ? <WarningIcon className="callout-icon warning" /> :
          variant === 'success' ? <SuccessIcon className="callout-icon success" /> :
          variant === 'error' ? <ErrorIcon className="callout-icon error" /> :
          <InfoIcon className="callout-icon info" />;
        return (
          <Box key={idx} className={`slide-callout ${variant}`}>
            {icon}
            <Typography variant="body2" className="callout-text">
              {parseFormattedText(block.text)}
            </Typography>
          </Box>
        );
      }

      case 'table':
        return (
          <Paper key={idx} className="slide-table-container glass-panel" elevation={0}>
            <table className="slide-table">
              {block.headers && block.headers.length > 0 && (
                <thead><tr>{block.headers.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
              )}
              <tbody>
                {block.rows?.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => (
                      <td key={cIdx}>
                        {cell.bold && <strong>{cell.bold}</strong>}
                        {parseFormattedText(cell.text)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Paper>
        );

      case 'normal_code': {
        const snippet = block.codeSnippet || block.raw?.codeSnippet || {};
        const language = snippet.language || block.raw?.language || block.language || 'code';
        const rawLines = snippet.lines || block.raw?.lines || block.lines || block.text?.split('\n') || [];
        const isRunable = block.runable !== undefined ? block.runable : (snippet.runable !== undefined ? snippet.runable : false);
        const codeText = rawLines.join('\n');
        return (
          <Paper key={idx} className="slide-code-card" elevation={0}>
            <div className="code-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CodeIcon fontSize="small" className="code-header-icon" />
                <span>{language.toUpperCase()}</span>
              </div>
              {isRunable && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<TerminalIcon />}
                  onClick={() => language.toLowerCase() === 'java' ? handleOpenJavaPlayground(codeText) : handleOpenCppPlayground(codeText)}
                  style={{
                    borderRadius: '8px',
                    fontWeight: 700,
                    textTransform: 'none',
                    fontSize: '0.75rem',
                    padding: '4px 12px',
                    borderColor: 'var(--primary-main)',
                    color: 'var(--primary-main)',
                  }}
                >
                  Run in Playground
                </Button>
              )}
            </div>
            <div className="code-card-body">
              <pre className="code-pre">
                {rawLines.map((line, lIdx) => (
                  <div key={lIdx} className="code-line">
                    <span className="code-line-number">{lIdx + 1}</span>
                    <span className="code-line-content">{highlightCppCode(line, isDarkMode)}</span>
                  </div>
                ))}
              </pre>
            </div>
          </Paper>
        );
      }

      case 'image': {
        const src = block.src || block.url || block.raw?.src || block.raw?.url || '';
        const alt = block.alt || block.caption || block.text || block.raw?.alt || '';
        return (
          <Paper key={idx} className="slide-image-card glass-panel" elevation={0} style={{ padding: '24px', margin: '20px 0', border: '1px solid rgba(255,255,255,0.08)', position: 'relative', overflow: 'hidden' }}>
            <Box style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '4px', background: 'var(--hero-gradient)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '14px' }}>
              <Box style={{ display: 'grid', placeItems: 'center', width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'rgba(28,176,246,0.1)', border: '1px solid rgba(28,176,246,0.2)', flexShrink: 0 }}>
                <BookIcon style={{ color: 'var(--primary-main)', fontSize: '24px' }} />
              </Box>
              <div style={{ textAlign: 'left' }}>
                <Typography variant="subtitle2" style={{ fontWeight: 800, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
                  {src ? src.replace(/_|-/g, ' ').replace('.png', '') : 'Visual Diagram'}
                </Typography>
                <Typography variant="caption" style={{ color: 'var(--text-secondary)' }}>Concept Reference Diagram</Typography>
              </div>
            </div>
            <Box style={{ padding: '14px', background: 'rgba(0,0,0,0.16)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
              <Typography variant="body2" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5, textAlign: 'left' }}>
                {alt || "Concept visual reference illustration."}
              </Typography>
            </Box>
          </Paper>
        );
      }

      default:
        return (
          <Box key={idx} className="slide-block-default glass-panel">
            <Typography variant="body2">{block.text || JSON.stringify(block)}</Typography>
          </Box>
        );
    }
  };

  if (isLoading) {
    return (
      <Box className="learning-content-loader">
        <Typography variant="h5" gutterBottom>Loading Lesson...</Typography>
        <LinearProgress className="loader-progress" />
      </Box>
    );
  }

  if (!lesson) {
    return (
      <Box className="learning-content-empty">
        <Typography variant="h5" gutterBottom>Lesson not found</Typography>
        <Button variant="contained" onClick={() => navigate('/')}>Go Back</Button>
      </Box>
    );
  }

  return (
    <Box className="learning-content-page">
      <header className="learning-content-header glass-panel">
        <Container maxWidth="lg" className="learning-header-content">
          <div className="learning-header-left">
            <IconButton onClick={() => navigate(`/course/${courseId}/${sectionId}`, { state: { returnedFromLessonId: lessonId } })} className="learning-back-btn">
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
          <IconButton onClick={() => navigate(`/course/${courseId}/${sectionId}`, { state: { returnedFromLessonId: lessonId } })} className="learning-close-btn">
            <CloseIcon />
          </IconButton>
        </Container>
        <LinearProgress variant="determinate" value={progressPercent} className="learning-progress-bar" />
      </header>

      <Container maxWidth="md" className="learning-slide-deck">
        <AnimatePresence mode="wait">
          {currentPage && (
            <motion.div
              key={currentPageIndex}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="learning-slide-container"
            >
              <Paper className="learning-slide-paper glass-panel-strong" elevation={0}>
                {currentPage.pageTitle && (
                  <Typography variant="h4" className="slide-page-title" gutterBottom>
                    {currentPage.pageTitle}
                  </Typography>
                )}
                <div className="slide-blocks-list">
                  {(() => {
                    if (!currentPage.blocks) return null;
                    const elements = [];
                    let i = 0;
                    while (i < currentPage.blocks.length) {
                      const block = currentPage.blocks[i];
                      if (block.type === 'uml_diagram' || block.raw?.type === 'uml_diagram') {
                        const group = [{ block, originalIdx: i }];
                        let j = i + 1;
                        while (j < currentPage.blocks.length && (currentPage.blocks[j].type === 'uml_diagram' || currentPage.blocks[j].raw?.type === 'uml_diagram')) {
                          group.push({ block: currentPage.blocks[j], originalIdx: j });
                          j++;
                        }
                        if (group.length > 1) {
                          elements.push(
                            <Box key={`uml-group-${i}`} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 3 }}>
                              {group.map((item, index) => (
                                <React.Fragment key={item.originalIdx}>
                                  {index > 0 && (
                                    <svg width="24" height="40" viewBox="0 0 24 40" style={{ display: 'block', margin: '4px 0' }}>
                                      <polygon points="12,0 0,16 24,16" fill="none" stroke="var(--primary-main)" strokeWidth="2" />
                                      <line x1="12" y1="16" x2="12" y2="40" stroke="var(--primary-main)" strokeWidth="2" />
                                    </svg>
                                  )}
                                  <Box sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                    {renderBlock(item.block, item.originalIdx)}
                                  </Box>
                                </React.Fragment>
                              ))}
                            </Box>
                          );
                        } else {
                          elements.push(
                            <Box key={`uml-${i}`} sx={{ my: 3 }}>
                              {renderBlock(block, i)}
                            </Box>
                          );
                        }
                        i = j;
                      } else {
                        elements.push(renderBlock(block, i));
                        i++;
                      }
                    }
                    return elements;
                  })()}
                </div>
              </Paper>
            </motion.div>
          )}
        </AnimatePresence>
      </Container>

      <footer className="learning-content-footer glass-panel">
        <Container maxWidth="md" className="learning-footer-content">
          <Button variant="outlined" onClick={handlePrevious}
            disabled={currentPageIndex === 0} startIcon={<LeftIcon />}
            className="footer-nav-btn">
            Previous
          </Button>
          <Button variant="contained" onClick={handleNext}
            disabled={!isPageCompleted(currentPageIndex)} endIcon={<RightIcon />}
            className="footer-nav-btn primary">
            {currentPageIndex === pages.length - 1 ? 'Finish Lesson' : 'Next'}
          </Button>
        </Container>
      </footer>

      {/* C++ Compiler Playground Dialog */}
      <CppPlaygroundDialog
        open={cppPlaygroundOpen}
        onClose={() => setCppPlaygroundOpen(false)}
        initialCode={playgroundCode}
      />
      {/* Java OOP Playground Dialog */}
      <JavaOopUmlPlayground
        open={javaPlaygroundOpen}
        onClose={() => setJavaPlaygroundOpen(false)}
        initialCode={playgroundCode}
      />
      {/* Code Challenge Dialog */}
      {selectedChallenge && (
        <ChallengePlaygroundDialog
          open={isChallengeOpen}
          onClose={() => setIsChallengeOpen(false)}
          challenge={selectedChallenge}
          isDarkMode={isDarkMode}
          onSolved={() => {
            if (selectedChallengeBlockIdx !== null) {
              const key = _blockKey(currentPageIndex, selectedChallengeBlockIdx);
              setExerciseAnswers(prev => ({ ...prev, [key]: true }));
            }
          }}
        />
      )}
      {/* Grade Dialog */}
      <Dialog
        open={showGradeDialog}
        onClose={() => navigate(`/course/${courseId}/${sectionId}`, { state: { returnedFromLessonId: lessonId } })}
        PaperProps={{
          style: {
            background: isDarkMode ? '#1e1e2d' : '#ffffff',
            borderRadius: '16px',
            minWidth: '350px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
          }
        }}
      >
        <DialogTitle style={{ textAlign: 'center', paddingTop: '32px' }}>
          <TrophyIcon style={{ fontSize: 64, color: '#FFD700', marginBottom: '16px' }} />
          <Typography variant="h4" style={{ fontWeight: 800, color: isDarkMode ? '#fff' : '#000' }}>
            Exercise Completed!
          </Typography>
        </DialogTitle>
        <DialogContent style={{ textAlign: 'center', paddingBottom: '24px' }}>
          {gradeInfo && (
            <Box style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}>
              <Typography variant="h2" style={{ fontWeight: 900, color: 'var(--primary-main)' }}>
                {gradeInfo.grade}%
              </Typography>
              <Typography variant="body1" style={{ color: isDarkMode ? '#b0b0c0' : '#666', fontSize: '1.1rem' }}>
                You got <b>{gradeInfo.correctQuestions}</b> out of <b>{gradeInfo.totalQuestions}</b> questions correct.
              </Typography>
              <Box style={{ background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', padding: '12px', borderRadius: '12px', display: 'inline-block' }}>
                <Typography variant="body2" style={{ color: isDarkMode ? '#fff' : '#000' }}>
                  Points Earned: <b>{gradeInfo.earnedPts}</b> / {gradeInfo.totalPts}
                </Typography>
                <Typography variant="caption" style={{ color: isDarkMode ? '#888' : '#888', display: 'block', marginTop: '4px' }}>
                  (Code challenges are worth 3 pts, others 1 pt)
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center', paddingBottom: '32px' }}>
          <Button 
            variant="contained" 
            onClick={() => navigate(`/course/${courseId}/${sectionId}`, { state: { returnedFromLessonId: lessonId } })}
            style={{ 
              background: 'var(--hero-gradient)', 
              color: '#fff', 
              borderRadius: '24px', 
              padding: '12px 32px',
              fontWeight: 700,
              fontSize: '1.1rem'
            }}
          >
            Continue to Roadmap
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default LearningContentPage;