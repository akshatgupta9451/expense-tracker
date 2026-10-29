import { render, screen } from '@testing-library/react'
import DeltaBadge from '@/components/dashboard/DeltaBadge'
import Sparkline from '@/components/dashboard/Sparkline'

const badge = (props) => render(<DeltaBadge {...props} />).container.firstChild

test('rising income is good (green), rising expense is bad (red)', () => {
  expect(badge({ value: 12.34, goodWhen: 'up' })).toHaveClass('text-emerald-700')
  expect(badge({ value: 12.34, goodWhen: 'down' })).toHaveClass('text-rose-700')
  expect(badge({ value: -8, goodWhen: 'down' })).toHaveClass('text-emerald-700')
  expect(screen.getAllByText('12.3%')).toHaveLength(2)
})

test('no comparison when last month was empty', () => {
  render(<DeltaBadge value={null} />)
  expect(screen.getByText('No data last month')).toBeInTheDocument()
})

test('flat change is neutral', () => {
  expect(badge({ value: 0.01 })).toHaveClass('text-gray-600')
})

test('sparkline renders only with a real trend', () => {
  expect(render(<Sparkline data={[0, 0, 0]} />).container.firstChild).toBeNull()
  expect(render(<Sparkline data={[5]} />).container.firstChild).toBeNull()
  const svg = render(<Sparkline data={[1, 3, 2]} />).container.querySelector('polyline')
  expect(svg.getAttribute('points').split(' ')).toHaveLength(3)
})
