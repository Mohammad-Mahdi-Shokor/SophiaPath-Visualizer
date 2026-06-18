import React, { useMemo, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { CppPlaygroundDialog } from '../components/CppPlaygroundDialog';
import { JavaOopUmlPlayground } from '../components/JavaOopUmlPlayground';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  useTheme,
  Tabs,
  Tab,
  Alert,
  Popover,
  Dialog,
  useMediaQuery,
  IconButton
} from '@mui/material';
import {
  School as SchoolIcon,
  CheckCircle as CheckCircleIcon,
  Timeline as TimelineIcon,
  EmojiEvents as TrophyIcon,
  ArrowForward as ArrowForwardIcon,
  Lock as LockIcon,
  PlayArrow as PlayIcon,
  ChevronRight as ChevronRightIcon,
  MenuBook as BookIcon,
  Close as CloseIcon,
  FitnessCenter as ExerciseIcon,
  SportsEsports as AssessmentIcon,
  Check as CheckIcon,
  ArrowUpward as ArrowUpwardIcon,
  ArrowDownward as ArrowDownwardIcon,
  Terminal as TerminalIcon
} from '@mui/icons-material';
import { loadCourseFile, normalizeCourse, findCourseByIdOrSlug } from '../utils/courseData.js';

import './LearningPathPage.css';

const getNodeIcon = (node) => {
  if (node.status === 'upcoming') {
    return <LockIcon sx={{ fontSize: 24 }} />;
  }

  const cat = node.category?.toLowerCase() || 'learning';
  if (cat === 'exercise' || cat === 'quiz' || cat === 'mcq') {
    return <ExerciseIcon sx={{ fontSize: 28 }} />;
  }
  if (cat === 'assessment' || cat === 'test' || cat === 'exam') {
    return <AssessmentIcon sx={{ fontSize: 28 }} />;
  }
  return <BookIcon sx={{ fontSize: 28 }} />;
};

const LearningPathPage = () => {
  const courseId = '2';
  const theme = useTheme();
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const navigate = useNavigate();
  const location = useLocation();

  const [isCompilerOpen, setIsCompilerOpen] = useState(false);
  const [isJavaUmlPlaygroundOpen, setIsJavaUmlPlaygroundOpen] = useState(false);

  const [course, setCourse] = useState(null);
  const [courseLoading, setCourseLoading] = useState(true);
  const [backendLessons, setBackendLessons] = useState({});
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [quizScores, setQuizScores] = useState({});

  const updateQuizScore = useCallback((lessonId, percentage) => {
    setQuizScores(prev => ({
      ...prev,
      [lessonId]: Math.max(prev[lessonId] || 0, percentage)
    }));
  }, []);

  // Roadmap Preview Popover & Dialog State
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);

  // FAB scrolling states
  const [showScrollArrow, setShowScrollArrow] = useState(false);
  const [scrollDirection, setScrollDirection] = useState('up');

  // Dynamic course loading from the visualizer's local info.csv file
  useEffect(() => {
    const loadCourse = async () => {
      try {
        if (location.state?.course) {
          setCourse(location.state.course);
        } else {
          const rawCourses = await loadCourseFile();
          const matched = findCourseByIdOrSlug(rawCourses, courseId);
          setCourse(matched ? normalizeCourse(matched) : null);
        }
      } catch (err) {
        console.error('Failed to load course path from info.csv:', err);
        setCourse(null);
      } finally {
        setCourseLoading(false);
      }
    };

    loadCourse();
  }, [courseId, location.state]);

  const [activeSectionIndex, setActiveSectionIndex] = useState(0);
  const [hasInitialSectionBeenSet, setHasInitialSectionBeenSet] = useState(false);



  const domainKey = course ? course.id : 'unknown';

  const scores = useMemo(() => quizScores, [quizScores]);

  const sections = useMemo(() => {
    if (!course || !course.sections) return [];

    return course.sections.map((section, sIndex) => {
      const currentLessons = backendLessons[section.id] || section.lessons || [];

      // Title-based deduplication for section lessons progress calculation
      const uniqueLessons = [];
      const seenTitles = new Set();
      currentLessons.forEach(l => {
        const norm = (l.title || '').trim().toLowerCase();
        if (norm && !seenTitles.has(norm)) {
          seenTitles.add(norm);
          uniqueLessons.push(l);
        }
      });

      const completedLessons = uniqueLessons.filter(l => {
        const duplicates = currentLessons.filter(dl => (dl.title || '').trim().toLowerCase() === (l.title || '').trim().toLowerCase());
        return duplicates.some(dl => (scores[dl.id] || 0) >= 70);
      });

      const isComplete = uniqueLessons.length > 0 && completedLessons.length === uniqueLessons.length;

      let isUnlocked = sIndex === 0;
      if (sIndex > 0) {
        const prevSection = course.sections[sIndex - 1];
        const prevLessons = backendLessons[prevSection.id] || prevSection.lessons || [];

        const uniquePrevLessons = [];
        const seenPrevTitles = new Set();
        prevLessons.forEach(pl => {
          const norm = (pl.title || '').trim().toLowerCase();
          if (norm && !seenPrevTitles.has(norm)) {
            seenPrevTitles.add(norm);
            uniquePrevLessons.push(pl);
          }
        });

        const prevSectionCompleted = uniquePrevLessons.filter(pl => {
          const duplicates = prevLessons.filter(dl => (dl.title || '').trim().toLowerCase() === (pl.title || '').trim().toLowerCase());
          return duplicates.some(dl => (scores[dl.id] || 0) >= 70);
        });

        isUnlocked = uniquePrevLessons.length > 0 && prevSectionCompleted.length === uniquePrevLessons.length;
      }

      return {
        ...section,
        isComplete,
        isUnlocked,
        progress: uniqueLessons.length > 0 ? (completedLessons.length / uniqueLessons.length) * 100 : 0
      };
    });
  }, [course, scores, backendLessons]);

  // Automatically select and open the first incomplete section when accessing the page or returning
  useEffect(() => {
    if (sections.length > 0 && !hasInitialSectionBeenSet) {
      if (location.state?.quizResult) {
        const { lessonId } = location.state.quizResult;
        const sectionIdx = sections.findIndex(s =>
          s.lessons?.some(l => l.id === lessonId)
        );
        if (sectionIdx !== -1) {
          setActiveSectionIndex(sectionIdx);
          setHasInitialSectionBeenSet(true);
          return;
        }
      }

      const firstIncompleteIdx = sections.findIndex(s => !s.isComplete);
      if (firstIncompleteIdx !== -1) {
        setActiveSectionIndex(firstIncompleteIdx);
      } else {
        setActiveSectionIndex(0);
      }
      setHasInitialSectionBeenSet(true);
    }
  }, [sections, location.state, hasInitialSectionBeenSet]);

  const activeSection = sections[activeSectionIndex];

  // Lessons are already present in info.csv, so no backend section fetch is needed.
  useEffect(() => {
    setBackendLessons({});
    setLoadingLessons(false);
  }, [course, activeSectionIndex]);

  const cheatsheetLesson = useMemo(() => {
    let rawLessons = [];
    if (activeSection && backendLessons[activeSection.id] && backendLessons[activeSection.id].length > 0) {
      rawLessons = backendLessons[activeSection.id];
    } else {
      rawLessons = activeSection?.lessons || [];
    }
    return rawLessons.find(l => {
      const title = (l.title || '').trim().toLowerCase();
      return title.startsWith('cheatsheet:') || title.startsWith('cheatsheet ') || title === 'cheatsheet';
    });
  }, [activeSection, backendLessons]);

  const isComputerScience = useMemo(() => {
    return course?.title?.toLowerCase()?.includes('computer science') || String(course?.id) === '2';
  }, [course]);

  const lessons = useMemo(() => {
    let rawLessons = [];
    if (activeSection && backendLessons[activeSection.id] && backendLessons[activeSection.id].length > 0) {
      rawLessons = backendLessons[activeSection.id];
    } else {
      rawLessons = activeSection?.lessons || [];
    }

    // Filter out cheatsheet lessons
    rawLessons = rawLessons.filter(l => {
      const title = (l.title || '').trim().toLowerCase();
      return !(title.startsWith('cheatsheet:') || title.startsWith('cheatsheet ') || title === 'cheatsheet');
    });

    // Title-based deduplication for nodes path list
    const uniqueLessons = [];
    const seenTitles = new Set();
    rawLessons.forEach(les => {
      const norm = (les.title || '').trim().toLowerCase();
      if (norm && !seenTitles.has(norm)) {
        seenTitles.add(norm);
        uniqueLessons.push(les);
      }
    });

    return uniqueLessons;
  }, [activeSection, backendLessons]);

  const csvCppCode = useMemo(() => {
    if (!course?.codeIndex?.cppSnippets?.length) return null;
    // Use the first runnable C++ snippet found in the course
    return course.codeIndex.cppSnippets[0] || null;
  }, [course]);

  const csvJavaExamples = useMemo(() => {
    if (!course?.codeIndex?.javaSnippets?.length) return [];
    // Return up to 3 Java code snippets from info.csv as examples
    return course.codeIndex.javaSnippets.slice(0, 3).map((code, idx) => ({
      name: `Java Example ${idx + 1} (from course)`,
      code,
      mainCode: null,
    }));
  }, [course]);

  const activeSectionCppCode = useMemo(() => {
    if (!activeSection?.lessons) return null;
    for (const lesson of activeSection.lessons) {
      const cppSnippet = (lesson.codeSnippets || []).find(s => s.language === 'cpp' && s.runnable);
      if (cppSnippet) return cppSnippet.code;
    }
    return null;
  }, [activeSection]);

  const activeSectionJavaExamples = useMemo(() => {
    if (!activeSection?.lessons) return [];
    const examples = [];
    for (const lesson of activeSection.lessons) {
      const javaSnips = (lesson.codeSnippets || []).filter(s => s.language === 'java');
      for (const snip of javaSnips) {
        examples.push({
          name: `${lesson.title} - Java Snippet`,
          code: snip.code,
          mainCode: null,
        });
      }
    }
    return examples.slice(0, 5);
  }, [activeSection]);

  const playgroundCppCode = activeSectionCppCode || csvCppCode || null;
  const playgroundJavaExamples = activeSectionJavaExamples.length > 0
    ? activeSectionJavaExamples
    : csvJavaExamples;

  // Sync results from QuizPage if any
  useEffect(() => {
    if (location.state?.quizResult) {
      const { lessonId, percentage } = location.state.quizResult;
      updateQuizScore(lessonId, percentage);
    }
  }, [location.state, updateQuizScore]);

  const nodes = useMemo(() => {
    const rawList = (activeSection && backendLessons[activeSection.id]) || activeSection?.lessons || [];
    let currentY = 0;

    return lessons.map((lesson, index) => {
      // Find all database duplicates of this unique lesson title
      const duplicates = rawList.filter(dl => (dl.title || '').trim().toLowerCase() === (lesson.title || '').trim().toLowerCase());

      // Consolidate the highest score among duplicates
      let score = 0;
      duplicates.forEach(dl => {
        const s = scores[dl.id] || 0;
        if (s > score) score = s;
      });

      const isPassed = score >= 70;

      let isPreviousPassed = index === 0;
      if (index > 0) {
        const prevLesson = lessons[index - 1];
        const prevDuplicates = rawList.filter(dl => (dl.title || '').trim().toLowerCase() === (prevLesson.title || '').trim().toLowerCase());
        isPreviousPassed = prevDuplicates.some(dl => (scores[dl.id] || 0) >= 70);
      }

      let status = 'upcoming';
      if (isPassed) status = 'completed';
      else if (isPreviousPassed) status = 'active';

      // Group and calculate dynamic height gap for new chapters
      const rawChapter = lesson.chapterName || 'General';
      const chapterName = rawChapter.trim().length > 0 ? rawChapter.trim() : 'General';

      let isNewChapter = false;
      if (index === 0) {
        isNewChapter = true;
      } else {
        const prevRawChapter = lessons[index - 1].chapterName || 'General';
        const prevChapterName = prevRawChapter.trim().length > 0 ? prevRawChapter.trim() : 'General';
        if (chapterName !== prevChapterName) {
          isNewChapter = true;
        }
      }

      currentY += index === 0 ? 160 : (isNewChapter ? 360 : 150);

      const x = index % 2 === 0 ? 45 : 255; // Larger horizontal zigzag within 300px visual container
      const y = currentY;
      const category = lesson.category || 'learning';

      return {
        ...lesson,
        chapterName,
        isNewChapter,
        category,
        status,
        score,
        pos: { x, y },
        icon: category === 'learning' ? <BookIcon /> : <SchoolIcon />
      };
    });
  }, [lessons, scores, activeSection, backendLessons]);

  // 1. Automatically scroll to the current/active node shell when course or lessons finish loading
  useEffect(() => {
    if (nodes.length > 0 && !courseLoading && !loadingLessons) {
      const timer = setTimeout(() => {
        const activeNodeEl = document.getElementById('current-active-node-shell');
        if (activeNodeEl) {
          activeNodeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 350);
      return () => clearTimeout(timer);
    }
  }, [nodes, courseLoading, loadingLessons]);

  // 2. Track viewport scrolling to toggle the fixed "Go to Current" FAB arrow
  useEffect(() => {
    const handleScroll = () => {
      const activeNodeEl = document.getElementById('current-active-node-shell');
      if (!activeNodeEl) {
        setShowScrollArrow(false);
        return;
      }

      const rect = activeNodeEl.getBoundingClientRect();
      // Element is visible if it is fully or partially within the vertical viewport bounds
      const isVisible = rect.top >= 0 && rect.bottom <= window.innerHeight;

      setShowScrollArrow(!isVisible);

      if (rect.top < 0) {
        setScrollDirection('up');
      } else if (rect.top > window.innerHeight) {
        setScrollDirection('down');
      }
    };

    window.addEventListener('scroll', handleScroll);
    // Initial check
    const initialTimer = setTimeout(handleScroll, 400);

    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(initialTimer);
    };
  }, [nodes, courseLoading, loadingLessons]);

  const handleScrollToActive = () => {
    const activeNodeEl = document.getElementById('current-active-node-shell');
    if (activeNodeEl) {
      activeNodeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const pathHeight = useMemo(() => {
    if (nodes.length === 0) return 300;
    return nodes[nodes.length - 1].pos.y + 110;
  }, [nodes]);

  const generatePath = () => {
    if (nodes.length < 2) return "";
    let d = `M ${nodes[0].pos.x} ${nodes[0].pos.y}`;
    for (let i = 1; i < nodes.length; i++) {
      const curr = nodes[i].pos;
      if (nodes[i].isNewChapter) {
        d += ` M ${curr.x} ${curr.y}`;
      } else {
        const prev = nodes[i - 1].pos;
        const cp1y = prev.y + (curr.y - prev.y) * 0.5;
        const cp2y = prev.y + (curr.y - prev.y) * 0.5;
        d += ` C ${prev.x} ${cp1y}, ${curr.x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
    }
    return d;
  };

  // Click handler: opens preview box instead of immediate navigation
  const handleNodeClick = (event, node) => {
    if (node.status === 'upcoming') return;
    setSelectedNode(node);

    // Check viewport width for adaptive UX
    const isMobile = window.innerWidth < 768;
    if (isMobile) {
      setOpenDialog(true);
    } else {
      setAnchorEl(event.currentTarget);
    }
  };

  const handleClosePreview = () => {
    setAnchorEl(null);
    setSelectedNode(null);
    setOpenDialog(false);
  };

  const handleStartLesson = () => {
    if (!selectedNode) return;
    navigate(`/learning/${domainKey}/${activeSection.id}/${selectedNode.id}`, { state: { course } });
    handleClosePreview();
  };

  const renderPreviewContent = () => {
    if (!selectedNode) return null;
    const isCompleted = selectedNode.status === 'completed';
    const accentColor = isCompleted ? '#58CC02' : 'var(--primary-main)';
    const buttonLabel = isCompleted ? 'RETAKE THE LESSON' : 'START THE LESSON';
    const categoryLabel = isCompleted ? 'COMPLETED LESSON' : (selectedNode.category === 'exercise' ? 'PRACTICE QUIZ' : 'ROADMAP LESSON');

    // Premium dynamic description based on category/title
    const description = selectedNode.category === 'exercise'
      ? `Test your knowledge with a quiz on "${selectedNode.title}". Answer the questions to prove your mastery and earn points!`
      : `Dive into "${selectedNode.title}" and learn key concepts in a step-by-step interactive slide viewer. Perfect for solidifying your fundamentals.`;

    return (
      <Box style={{ position: 'relative' }}>
        {isMobileViewport && (
          <IconButton
            style={{ position: 'absolute', right: '-12px', top: '-12px', color: 'var(--text-secondary)' }}
            onClick={handleClosePreview}
          >
            <CloseIcon />
          </IconButton>
        )}
        <Box style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
          <Box style={{ flex: 1 }}>
            <Typography
              variant="caption"
              style={{
                color: accentColor,
                fontWeight: 800,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                display: 'block',
                marginBottom: '4px'
              }}
            >
              {categoryLabel}
            </Typography>
            <Typography
              variant="h5"
              style={{
                fontWeight: 900,
                fontSize: '1.25rem',
                lineHeight: 1.3,
                color: 'var(--text-primary)',
                fontFamily: '"Outfit", sans-serif'
              }}
            >
              {selectedNode.title}
            </Typography>
          </Box>
          <Box
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              backgroundColor: isCompleted ? '#58CC02' : '#1CB0F6',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 8px 16px rgba(0,0,0,0.15)',
              flexShrink: 0
            }}
          >
            {selectedNode.category === 'exercise' || selectedNode.category === 'quiz' || selectedNode.category === 'mcq' ? (
              <ExerciseIcon style={{ color: '#fff', fontSize: '26px' }} />
            ) : selectedNode.category === 'assessment' || selectedNode.category === 'test' ? (
              <AssessmentIcon style={{ color: '#fff', fontSize: '26px' }} />
            ) : (
              <BookIcon style={{ color: '#fff', fontSize: '26px' }} />
            )}
          </Box>
        </Box>

        <Typography
          variant="body2"
          style={{
            marginTop: '16px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            fontSize: '0.9rem'
          }}
        >
          {description}
        </Typography>

        {isCompleted && selectedNode.score > 0 && (
          <Box
            style={{
              marginTop: '14px',
              padding: '8px 12px',
              backgroundColor: 'rgba(88, 204, 2, 0.1)',
              border: '1px solid rgba(88, 204, 2, 0.2)',
              borderRadius: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircleIcon style={{ color: '#58CC02', fontSize: '18px' }} />
            <Typography variant="body2" style={{ color: '#58CC02', fontWeight: 700, fontSize: '0.85rem' }}>
              High Score: {selectedNode.score}%
            </Typography>
          </Box>
        )}

        <Button
          fullWidth
          variant="contained"
          onClick={handleStartLesson}
          style={{
            marginTop: '20px',
            padding: '12px',
            borderRadius: '14px',
            fontWeight: 800,
            fontSize: '0.9rem',
            backgroundColor: accentColor,
            color: '#fff',
            boxShadow: `0 8px 20px ${isCompleted ? 'rgba(88,204,2,0.25)' : 'rgba(var(--primary-main-rgb), 0.25)'}`,
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            fontFamily: '"Outfit", sans-serif',
            textTransform: 'none'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {buttonLabel}
        </Button>
      </Box>
    );
  };

  if (courseLoading) {
    return (
      <div className="course-not-found" style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="loading-spinner" style={{ width: '50px', height: '50px', borderRadius: '50%', border: '3px solid rgba(255,255,255,0.1)', borderTopColor: 'var(--primary-main)', animation: 'spin 1s linear infinite' }} />
        <Typography variant="h6" style={{ color: 'var(--text-secondary)' }}>Loading Learning Path...</Typography>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (!course) {
    return (
      <Box className="path-page-empty">
        <Typography variant="h5">No course selected</Typography>
        <Button onClick={() => navigate('/')}>Go to Dashboard</Button>
      </Box>
    );
  }

  const nextActiveNode = nodes.find(n => n.status === 'active') || nodes[nodes.length - 1];

  return (
    <Box className="path-page">
      <Container maxWidth="md">

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, mt: 1, flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h5" style={{ fontWeight: 900, fontFamily: '"Outfit", sans-serif', color: 'var(--text-primary)' }}>
            Course Roadmap
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, alignItems: 'stretch' }}>
            {isComputerScience && (
              <>
                <Button
                  variant="contained"
                  startIcon={<TerminalIcon />}
                  onClick={() => setIsCompilerOpen(true)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    textTransform: 'none',
                    background: 'var(--hero-gradient)',
                    color: '#fff',
                    boxShadow: '0 6px 15px rgba(var(--primary-main-rgb), 0.25)',
                    fontFamily: '"Outfit", sans-serif'
                  }}
                >
                  C++ Compiler Playground
                </Button>
                <Button
                  variant="contained"
                  startIcon={<SchoolIcon />}
                  onClick={() => setIsJavaUmlPlaygroundOpen(true)}
                  style={{
                    padding: '8px 18px',
                    borderRadius: '12px',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #6e8efb, #a777e3)',
                    color: '#fff',
                    boxShadow: '0 6px 15px rgba(167, 119, 227, 0.25)',
                    fontFamily: '"Outfit", sans-serif'
                  }}
                >
                  Java OOP UML Playground
                </Button>
              </>
            )}
            {cheatsheetLesson && (
              <Button
                variant="outlined"
                startIcon={<BookIcon />}
                onClick={() => {
                  navigate(`/learning/${domainKey}/${activeSection.id}/${cheatsheetLesson.id}`, { state: { course } });
                }}
                style={{
                  padding: '8px 18px',
                  borderRadius: '12px',
                  fontWeight: 800,
                  fontSize: '0.85rem',
                  textTransform: 'none',
                  borderColor: 'var(--primary-main)',
                  color: 'var(--primary-main)',
                  boxShadow: '0 4px 10px rgba(var(--primary-main-rgb), 0.1)',
                  fontFamily: '"Outfit", sans-serif'
                }}
              >
                View Cheatsheet
              </Button>
            )}

          </Box>
        </Box>


        <Box className="path-sections-tabs glass-panel" sx={{ mb: 4, borderRadius: 3 }}>
          <Tabs
            value={activeSectionIndex}
            onChange={(e, val) => setActiveSectionIndex(val)}
            variant="scrollable"
            scrollButtons="auto"
            sx={{ px: 2 }}
          >
            {sections.map((section) => (
              <Tab
                key={section.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {section.title}
                    {!section.isUnlocked && <LockIcon sx={{ fontSize: 16 }} />}
                  </Box>
                }
                disabled={!section.isUnlocked}
              />
            ))}
          </Tabs>
        </Box>

        {!activeSection?.isUnlocked && (
          <Alert severity="warning" sx={{ mb: 4, borderRadius: 3 }}>
            Complete the previous section to unlock this path.
          </Alert>
        )}

        <Box className="path-visual-shell glass-panel-strong">
          <Box className="path-visual" style={{ height: `${pathHeight}px` }}>
            <svg
              width="300"
              height={pathHeight}
              className="path-svg"
              viewBox={`0 0 300 ${pathHeight}`}
            >
              <defs>
                <linearGradient id="pathGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor={theme.palette.primary.main} stopOpacity="0.2" />
                  <stop offset="100%" stopColor={theme.palette.primary.main} stopOpacity="0.05" />
                </linearGradient>
              </defs>

              <path
                d={generatePath()}
                fill="none"
                stroke="url(#pathGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray="15 15"
              />
            </svg>

            {nodes.map((node, index) => (
              <React.Fragment key={node.id}>
                {node.isNewChapter && (
                  <Box
                    style={{
                      position: 'absolute',
                      left: '150px',
                      top: `${node.pos.y - (index === 0 ? 126 : 220)}px`,
                      transform: 'translateX(-50%)',
                      zIndex: 5,
                      width: '1200px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      pointerEvents: 'none',
                      gap: '24px'
                    }}
                  >
                    {index > 0 && (
                      <Box style={{ width: '100%', height: '0', borderTop: '3px dotted var(--text-secondary)', opacity: 0.4 }} />
                    )}
                    <Typography
                      variant="h5"
                      style={{
                        fontWeight: 900,
                        color: 'var(--text-primary)',
                        background: 'var(--surface-glass)',
                        padding: '12px 32px',
                        borderRadius: '30px',
                        border: '1px solid var(--divider)',
                        backdropFilter: 'blur(12px)',
                        fontFamily: '"Outfit", sans-serif',
                        boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                        textAlign: 'center',
                        textTransform: 'uppercase',
                        letterSpacing: '1.5px',
                        fontSize: '1.35rem'
                      }}
                    >
                      {node.chapterName}
                    </Typography>
                  </Box>
                )}


                <Box
                  id={node.id === nextActiveNode?.id ? "current-active-node-shell" : undefined}
                  className="path-node-shell"
                  style={{
                    left: `${node.pos.x}px`,
                    top: `${node.pos.y}px`,
                    transform: 'translate(-50%, -50%)'
                  }}
                  onClick={(e) => handleNodeClick(e, node)}
                >
                  <Box className="path-node-wrapper">
                    {node.status === 'active' && (
                      <Box className="path-node-pulse" />
                    )}

                    <Box className={`path-node path-node-${node.status}`}>
                      {getNodeIcon(node)}
                    </Box>

                    {/* Top-right completed check badge matching mobile app */}
                    {node.status === 'completed' && (
                      <Box
                        style={{
                          position: 'absolute',
                          top: '-4px',
                          right: '-4px',
                          width: '22px',
                          height: '22px',
                          borderRadius: '50%',
                          backgroundColor: '#fff',
                          border: '2.5px solid #29c57b',
                          display: 'grid',
                          placeItems: 'center',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                          zIndex: 10
                        }}
                      >
                        <CheckIcon style={{ color: '#29c57b', fontSize: '12px', fontWeight: 'bold' }} />
                      </Box>
                    )}

                    {/* Bottom percentage badge matching mobile app */}
                    {node.status === 'completed' && node.score > 0 && (
                      <Box
                        style={{
                          position: 'absolute',
                          bottom: '-8px',
                          left: '50%',
                          transform: 'translateX(-50%)',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          backgroundColor: node.score < 50 ? '#ff4d4d' : node.score < 80 ? '#ff9900' : '#29c57b',
                          border: '1.5px solid #fff',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.2)',
                          zIndex: 10
                        }}
                      >
                        <Typography
                          style={{
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: '0.68rem',
                            lineHeight: 1,
                            fontFamily: '"Nunito", sans-serif'
                          }}
                        >
                          {node.score}%
                        </Typography>
                      </Box>
                    )}

                    <Typography className={`path-node-caption-title status-${node.status}`}>
                      {node.title}
                    </Typography>
                  </Box>
                </Box>
              </React.Fragment>
            ))}
          </Box>
        </Box>

        <Box className="path-footer glass-panel">
          <Box className="path-footer-content">
            <Typography variant="h4" className="path-footer-title">
              {activeSection?.isComplete ? "Section Completed!" : "Ready for the next challenge?"}
            </Typography>
            <div className="path-footer-copy">
              {activeSection?.isComplete
                ? `You've mastered all lessons in ${activeSection.title}.`
                : `Progress in this section: ${Math.round(activeSection?.progress || 0)}%`}
            </div>
            {!activeSection?.isComplete && (
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                className="path-footer-button"
                onClick={(e) => handleNodeClick(e, nextActiveNode)}
              >
                {nextActiveNode?.status === 'active' ? `Start ${nextActiveNode.title}` : "Continue Learning"}
              </Button>
            )}
            {activeSection?.isComplete && activeSectionIndex < sections.length - 1 && (
              <Button
                variant="contained"
                size="large"
                endIcon={<ChevronRightIcon />}
                className="path-footer-button"
                onClick={() => setActiveSectionIndex(prev => prev + 1)}
              >
                Next Section
              </Button>
            )}
          </Box>
        </Box>

        {/* Roadmap Node Preview - Desktop Floating Popover */}
        <Popover
          open={Boolean(anchorEl) && !isMobileViewport}
          anchorEl={anchorEl}
          onClose={handleClosePreview}
          anchorOrigin={{
            vertical: 'center',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'center',
            horizontal: 'left',
          }}
          PaperProps={{
            style: {
              borderRadius: '24px',
              padding: '24px',
              width: '320px',
              border: selectedNode?.status === 'completed'
                ? '2px solid rgba(88, 204, 2, 0.4)'
                : '1px solid var(--divider)',
              background: selectedNode?.status === 'completed'
                ? (theme.palette.mode === 'dark' ? 'rgba(31, 45, 31, 0.96)' : 'rgba(242, 251, 240, 0.96)')
                : 'var(--surface-glass)',
              boxShadow: 'var(--shadow-soft)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }
          }}
        >
          {renderPreviewContent()}
        </Popover>

        {/* Roadmap Node Preview - Mobile Centered Dialog */}
        <Dialog
          open={openDialog && isMobileViewport}
          onClose={handleClosePreview}
          fullWidth
          maxWidth="xs"
          PaperProps={{
            style: {
              borderRadius: '24px',
              padding: '24px',
              border: selectedNode?.status === 'completed'
                ? '2px solid rgba(88, 204, 2, 0.4)'
                : '1px solid var(--divider)',
              background: selectedNode?.status === 'completed'
                ? (theme.palette.mode === 'dark' ? 'rgba(31, 45, 31, 0.96)' : 'rgba(242, 251, 240, 0.96)')
                : 'var(--surface-glass)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }
          }}
        >
          {renderPreviewContent()}
        </Dialog>

      </Container>
      {showScrollArrow && createPortal(
        <IconButton
          className="path-floating-action-btn"
          onClick={handleScrollToActive}
          aria-label="scroll to current lesson"
        >
          {scrollDirection === 'up' ? <ArrowUpwardIcon /> : <ArrowDownwardIcon />}
        </IconButton>,
        document.body
      )}

      <CppPlaygroundDialog
        open={isCompilerOpen}
        onClose={() => setIsCompilerOpen(false)}
        initialCode={playgroundCppCode}
      />
      <JavaOopUmlPlayground
        open={isJavaUmlPlaygroundOpen}
        onClose={() => setIsJavaUmlPlaygroundOpen(false)}
        csvExamples={playgroundJavaExamples}
      />
    </Box>
  );
};

export default LearningPathPage;
