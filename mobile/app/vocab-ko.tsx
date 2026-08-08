import { CourseScreen } from '../components/CourseScreen';
import { COURSES } from '../lib/courses';

export default function VocabKoScreen() {
  return <CourseScreen course={COURSES.ko} />;
}
