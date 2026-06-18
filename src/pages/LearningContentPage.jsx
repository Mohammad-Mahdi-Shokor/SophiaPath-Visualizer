import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
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
  useMediaQuery
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { loadCourseFile, normalizeCourse, findCourseByIdOrSlug } from '../utils/courseData.js';

const getBlockKey = (page, blockIndex) => `${page.pageId || page.orderIndex}-${blockIndex}`;

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
        setAnswers({});
        setFillCodeValues({});
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

  const answerForBlock = (page, blockIndex) => answers[`${getBlockKey(page, blockIndex)}`];

  const isInputCorrect = (input, key) => {
    if (!input || typeof input.expectedAnswer !== 'string') return false;
    const value = String(fillCodeValues[key] || '').trim();
    return value === String(input.expectedAnswer || '').trim();
  };

  const setMultipleChoiceAnswer = (page, blockIndex, answerIndex) => {
    setAnswers(prev => ({ ...prev, [getBlockKey(page, blockIndex)]: answerIndex }));
  };

  const setFillCodeAnswer = (page, blockIndex, inputIndex, value) => {
    const key = `${getBlockKey(page, blockIndex)}-${inputIndex}`;
    setFillCodeValues(prev => ({ ...prev, [key]: value }));
  };

  const setChallengeAnswer = (page, blockIndex, value) => {
    setAnswers(prev => ({ ...prev, [getBlockKey(page, blockIndex)]: value }));
  };

  const isBlockComplete = (page, blockIndex, block) => {
    const key = getBlockKey(page, blockIndex);
    if (!block || !block.type) return true;

    if (block.type === 'mcq' || block.type === 'find_error') {
      return typeof answers[key] === 'number';
    }

    if (block.type === 'fill_code') {
      const inputs = (block.codeTemplate?.lines || []).filter(line => line.type === 'input');
      return inputs.every((input, idx) => {
        const inputKey = `${key}-${idx}`;
        return String(fillCodeValues[inputKey] || '').trim().length > 0;
      });
    }

    if (block.type === 'code_challenge') {
      return typeof answers[key] === 'string' && answers[key].trim().length > 0;
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

    pages.forEach((page, pageIndex) => {
      (page.blocks || []).forEach((block, blockIndex) => {
        const key = getBlockKey(page, blockIndex);
        if (block.type === 'mcq' || block.type === 'find_error') {
          total += 1;
          if (typeof answers[key] === 'number' && answers[key] === block.correctAnswer) {
            correct += 1;
          }
        }

        if (block.type === 'fill_code') {
          const inputs = (block.codeTemplate?.lines || []).filter(line => line.type === 'input');
          if (inputs.length > 0) {
            total += 1;
            const allCorrect = inputs.every((input, idx) => isInputCorrect(input, `${key}-${idx}`));
            if (allCorrect) correct += 1;
          }
        }

        if (block.type === 'code_challenge') {
          total += 1;
          if (typeof answers[key] === 'string' && answers[key].trim().length > 0) {
            correct += 1;
          }
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
    const key = getBlockKey(page, blockIndex);

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
            sx={{ mb: 2, whiteSpace: 'pre-line' }}
            dangerouslySetInnerHTML={{ __html: block.text || '' }}
          />
        );
      case 'image':
        return (
          <Box key={key} sx={{ mb: 3, textAlign: 'center' }}>
            <Box
              component="img"
              src={block.src || ''}
              alt={block.alt || 'illustration'}
              sx={{ maxWidth: '100%', borderRadius: 4, boxShadow: 3 }}
            />
            {block.alt && (
              <Typography variant="caption" sx={{ display: 'block', mt: 1, color: 'text.secondary' }}>
                {block.alt}
              </Typography>
            )}
          </Box>
        );
      case 'bullet_list':
        return (
          <Box key={key} component="ul" sx={{ mb: 2, pl: 3 }}>
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
      case 'normal_code':
        return (
          <Paper key={key} variant="outlined" sx={{ p: 2, mb: 2, bgcolor: 'background.paper' }}>
            <Typography variant="body2" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
              {(block.codeSnippet?.lines || []).join('\n')}
            </Typography>
          </Paper>
        );
      case 'mcq':
      case 'find_error': {
        const choices = block.answers || [];
        const selectedIndex = answerForBlock(page, blockIndex);
        const isCorrect = typeof selectedIndex === 'number' && selectedIndex === block.correctAnswer;

        return (
          <Paper key={key} variant="outlined" sx={{ p: 3, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }} dangerouslySetInnerHTML={{ __html: block.question || block.instruction || '' }} />
            <RadioGroup
              value={selectedIndex ?? ''}
              onChange={(event) => setMultipleChoiceAnswer(page, blockIndex, Number(event.target.value))}
            >
              {choices.map((item, idx) => {
                const isChoiceCorrect = block.correctAnswer === idx;
                const showFeedback = typeof selectedIndex === 'number';
                return (
                  <FormControlLabel
                    key={idx}
                    value={idx}
                    control={<Radio />}
                    label={item.answer}
                    sx={{
                      mb: 1,
                      bgcolor: showFeedback && isChoiceCorrect ? 'rgba(56, 142, 60, 0.08)' : undefined,
                      borderRadius: 2,
                      p: 1
                    }}
                  />
                );
              })}
            </RadioGroup>
            {typeof selectedIndex === 'number' && (
              <Typography variant="body2" sx={{ color: isCorrect ? 'success.main' : 'error.main', mt: 1 }}>
                {isCorrect ? 'Correct!' : 'That answer is not correct yet.'}
              </Typography>
            )}
          </Paper>
        );
      }
      case 'fill_code': {
        const lines = (block.codeTemplate?.lines || []);
        return (
          <Paper key={key} variant="outlined" sx={{ p: 3, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }} dangerouslySetInnerHTML={{ __html: block.instruction || '' }} />
            <Box component="pre" sx={{ p: 2, bgcolor: 'background.default', borderRadius: 2, overflowX: 'auto', fontFamily: 'monospace' }}>
              {lines.map((line, idx) => {
                if (line.type === 'code') {
                  return (
                    <Box key={idx} component="span" sx={{ display: 'block' }}>
                      {line.content || ''}
                    </Box>
                  );
                }

                if (line.type === 'input') {
                  const inputKey = `${key}-${idx}`;
                  return (
                    <Box key={idx} sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <TextField
                        value={fillCodeValues[inputKey] || ''}
                        onChange={(event) => setFillCodeAnswer(page, blockIndex, idx, event.target.value)}
                        size="small"
                        sx={{ width: `${Math.min(Math.max(line.width || 6, 4), 32) * 10}px`, bgcolor: 'background.paper' }}
                      />
                    </Box>
                  );
                }

                return null;
              })}
            </Box>
            <Typography variant="body2" color={isPageCompleted(currentPage) ? 'success.main' : 'text.secondary'}>
              {isPageCompleted(currentPage) ? 'All fill-in answers entered.' : 'Enter a value for each code placeholder above.'}
            </Typography>
          </Paper>
        );
      }
      case 'code_challenge':
        return (
          <Paper key={key} variant="outlined" sx={{ p: 3, mb: 2 }}>
            <Typography variant="subtitle1" sx={{ mb: 2 }} dangerouslySetInnerHTML={{ __html: block.instruction || '' }} />
            <TextField
              multiline
              minRows={6}
              fullWidth
              value={answerForBlock(page, blockIndex) || ''}
              onChange={(event) => setChallengeAnswer(page, blockIndex, event.target.value)}
              placeholder="Write your answer or explanation here..."
            />
          </Paper>
        );
      default:
        return null;
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
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={handleGoBack}
        sx={{ mb: 3, textTransform: 'none' }}
      >
        Back to Roadmap
      </Button>
      <Typography variant="h4" sx={{ mb: 1, fontWeight: 900 }}>
        {lesson.title}
      </Typography>
      <Typography variant="subtitle1" sx={{ mb: 2, color: 'text.secondary' }}>
        {lesson.chapterName || course.title}
      </Typography>

      <Paper variant="outlined" sx={{ p: 3, mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ flexGrow: 1, minWidth: 240 }}>
            <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
              Lesson Progress
            </Typography>
            <LinearProgress variant="determinate" value={progress} sx={{ height: 10, borderRadius: 5 }} />
          </Box>
          <Typography variant="body2" sx={{ minWidth: 80, color: 'text.secondary' }}>
            {progress}%
          </Typography>
        </Box>
      </Paper>

      {currentPage ? (
        <Box>
          <Typography variant="h5" sx={{ mb: 2, fontWeight: 700 }} dangerouslySetInnerHTML={{ __html: currentPage.pageTitle || `Page ${currentPageIndex + 1}` }} />
          {currentPage.blocks?.map((block, blockIndex) => renderBlock(block, currentPage, currentPageIndex, blockIndex))}
        </Box>
      ) : (
        <Typography variant="body1">This lesson does not contain page content yet.</Typography>
      )}

      {errorMessage && (
        <Typography variant="body2" color="error.main" sx={{ mt: 2 }}>{errorMessage}</Typography>
      )}

      <Stack direction={isMobileViewport ? 'column' : 'row'} spacing={2} sx={{ mt: 4, justifyContent: 'space-between' }}>
        <Button
          variant="outlined"
          disabled={currentPageIndex === 0}
          onClick={() => handlePageChange(-1)}
          startIcon={<ArrowBackIcon />}
          sx={{ textTransform: 'none' }}
        >
          Previous
        </Button>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {currentPageIndex < pages.length - 1 ? (
            <Button
              variant="contained"
              onClick={() => handlePageChange(1)}
              endIcon={<ArrowForwardIcon />}
              sx={{ textTransform: 'none' }}
            >
              Next Page
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleFinish}
              sx={{ textTransform: 'none' }}
            >
              Finish Lesson
            </Button>
          )}
        </Box>
      </Stack>
    </Container>
  );
};

export default LearningContentPage;
