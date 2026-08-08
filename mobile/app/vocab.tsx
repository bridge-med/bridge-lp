import { CourseScreen } from '../components/CourseScreen';
import { COURSES } from '../lib/courses';

export default function VocabScreen() {
  return <CourseScreen course={COURSES.en} />;
}
