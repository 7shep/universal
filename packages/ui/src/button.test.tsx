import assert from 'node:assert/strict';
import test from 'node:test';
import { Button } from './button.js';

test('defaults to type=button outside and inside forms', () => {
  const button = Button({ children: 'Action' });

  assert.equal(button.props.type, 'button');
  assert.equal(button.props.children, 'Action');
});

test('preserves explicit native button types and forwarded props', () => {
  for (const type of ['submit', 'reset'] as const) {
    const button = Button({
      children: type,
      type,
      tone: 'quiet',
      className: 'custom-action',
      name: 'intent',
      value: type
    });

    assert.equal(button.props.type, type);
    assert.equal(button.props.name, 'intent');
    assert.equal(button.props.value, type);
    assert.match(button.props.className, /ds-button--quiet/);
    assert.match(button.props.className, /custom-action/);
  }
});
