import { Link } from 'react-router-dom'
import { Button } from '../components/ui/Button'

export function NotFoundPage() {
  return (
    <div className="state" style={{ paddingTop: '4rem' }}>
      <span className="state__mark" aria-hidden="true">
        404
      </span>
      <h1 className="state__title">That page is not on the floor plan</h1>
      <p className="state__text">
        The address you followed does not match anything in the salon application.
      </p>
      <Link to="/overview">
        <Button variant="primary">Back to overview</Button>
      </Link>
    </div>
  )
}
