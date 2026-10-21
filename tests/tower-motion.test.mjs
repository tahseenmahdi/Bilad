import assert from 'node:assert/strict';
import test from 'node:test';
import { snippetMotion, springStep, towerMotion } from '../src/lib/tower-motion.ts';

const sample = position => towerMotion(position, 800, 560, 824, 1.38);

test('the intact pose fully restores the photo and its cut edges', () => {
  const pose = sample(0);
  assert.ok(pose.offsets.every(offset => offset === 0));
  assert.ok(pose.opacities.every(opacity => opacity === 1));
  assert.ok(pose.feathers.every(opacity => opacity === 0));
  assert.equal(pose.cameraY, 0);
  assert.equal(pose.zoom, 1);
});

test('spring follows a changed target during movement and settles without overshooting', () => {
  let position = 2;
  let velocity = 0;
  for (let frame = 0; frame < 10; frame++) {
    const next = springStep(position, velocity, 3, 1 / 60);
    position = next.position; velocity = next.velocity;
  }
  assert.ok(position > 2 && position < 3);
  const previousVelocity = velocity;
  let next = springStep(position, velocity, 2, 1 / 10000);
  assert.ok(Math.abs(next.velocity - previousVelocity) < .03, 'reversal preserves velocity');
  for (let frame = 0; frame < 120; frame++) {
    next = springStep(position, velocity, 2, 1 / 60);
    position = next.position; velocity = next.velocity;
    assert.ok(position >= 2 && position < 3);
  }
  assert.ok(Math.abs(position - 2) < .00001);
  assert.ok(Math.abs(velocity) < .0001);
});

test('floor, camera and fading remain continuous at every scroll stop in both directions', () => {
  for (let stage = 1; stage <= 6; stage++) {
    const before = sample(stage - .00001);
    const after = sample(stage + .00001);
    for (const key of ['offsets', 'opacities', 'feathers', 'stories']) {
      before[key].forEach((value, index) => assert.ok(Math.abs(value - after[key][index]) < .01, `${stage}: ${key}`));
    }
    assert.ok(Math.abs(before.cameraY - after.cameraY) < .01);
    assert.ok(Math.abs(before.zoom - after.zoom) < .01);
  }
});

test('each opening feathers only separated seams and keeps both framing floors clear', () => {
  for (let stage = 1; stage <= 6; stage++) {
    const pose = sample(stage);
    assert.deepEqual(pose.feathers, Array.from({ length: 6 }, (_, index) => index < stage ? 1 : 0));
    assert.equal(pose.opacities[stage - 1], 1);
    assert.equal(pose.opacities[stage], 1);
  }
  const halfOpen = sample(.5);
  assert.ok(halfOpen.feathers[0] > 0 && halfOpen.feathers[0] < 1);
  assert.ok(halfOpen.offsets[0] < 0 && halfOpen.offsets[0] > sample(1).offsets[0]);
});

test('snippets are fully readable at rest and fade symmetrically on either side', () => {
  for (let stage = 1; stage <= 6; stage++) {
    assert.deepEqual(snippetMotion(stage, stage), { opacity: 1, shift: -0, blur: 0 });
    assert.ok(Math.abs(snippetMotion(stage - .4, stage).opacity - snippetMotion(stage + .4, stage).opacity) < 1e-12);
    assert.equal(snippetMotion(stage - .6, stage).opacity, 0);
    assert.equal(snippetMotion(stage + .6, stage).opacity, 0);
  }
});
