import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const generateQuestions = (lessonId, topic) => {
  return Array.from({ length: 5 }, (_, i) => ({
    id: `q-${lessonId}-${i + 1}`,
    prompt: `Question ${i + 1} about ${topic}: What is the core concept of ${topic} in this context?`,
    answers: [
      { id: `ans-${lessonId}-${i + 1}-1`, text: `Correct answer for ${topic} focus ${i + 1}`, isCorrect: true },
      { id: `ans-${lessonId}-${i + 1}-2`, text: `Distractor A for ${topic}`, isCorrect: false },
      { id: `ans-${lessonId}-${i + 1}-3`, text: `Distractor B for ${topic}`, isCorrect: false },
      { id: `ans-${lessonId}-${i + 1}-4`, text: `Distractor C for ${topic}`, isCorrect: false },
    ]
  }));
};

const generateLessons = (sectionId, sectionTopic, count = 10) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `${sectionId}-lesson-${i + 1}`,
    title: `${sectionTopic} Module ${i + 1}`,
    description: `Deep dive into ${sectionTopic} - Part ${i + 1}.`,
    questions: generateQuestions(`${sectionId}-lesson-${i + 1}`, sectionTopic)
  }));
};

const mobileDevCourse = {
  id: "mobile-dev",
  title: "Mobile Development",
  domain: "Technology",
  description: "Master the art of building cross-platform mobile applications.",
  about: "This comprehensive path covers everything from basic UI components to complex state management and native integrations. You will learn how to build apps that run seamlessly on both iOS and Android.",
  totalLessons: 30,
  sections: [
    {
      id: "mobile-sec-1",
      title: "Foundations & UI",
      lessons: generateLessons("mobile-sec-1", "Mobile Foundations")
    },
    {
      id: "mobile-sec-2",
      title: "State & Logic",
      lessons: generateLessons("mobile-sec-2", "App Logic")
    },
    {
      id: "mobile-sec-3",
      title: "Advanced Integration",
      lessons: generateLessons("mobile-sec-3", "Mobile Advanced")
    }
  ]
};

const content = "export const mobileDevCourse = " + JSON.stringify(mobileDevCourse, null, 2) + ";";
fs.writeFileSync(path.join(__dirname, '../src/data/courses/mobileDev.js'), content, 'utf8');
console.log("File written successfully");
