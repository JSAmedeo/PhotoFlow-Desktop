import { describe, it, expect } from 'vitest';
import { parsePhotoFilename } from './filenameParser';

describe('parsePhotoFilename', () => {
  it('parses a standard session ID', () => {
    const result = parsePhotoFilename('XYZ123456.jpg');
    expect(result.sessionKey).toBe('XYZ123456');
    expect(result.routingConfidence).toBe('matched');
    expect(result.sequenceNumber).toBeNull();
  });

  it('parses a session ID with underscore sequence suffix', () => {
    const result = parsePhotoFilename('XYZ123456_01.jpg');
    expect(result.sessionKey).toBe('XYZ123456');
    expect(result.sequenceNumber).toBe(1);
    expect(result.sequenceLabel).toBe('01');
  });

  it('parses a session ID with dash sequence suffix', () => {
    const result = parsePhotoFilename('XYZ123456-001.jpg');
    expect(result.sessionKey).toBe('XYZ123456');
    expect(result.sequenceNumber).toBe(1);
    expect(result.sequenceLabel).toBe('001');
  });

  it('parses a session ID embedded mid-filename', () => {
    const result = parsePhotoFilename('IMG_4021_XYZ123456_05.jpg');
    expect(result.sessionKey).toBe('XYZ123456');
    expect(result.sequenceNumber).toBe(5);
    expect(result.sequenceLabel).toBe('05');
  });

  it('normalizes a lowercase session ID to uppercase', () => {
    const result = parsePhotoFilename('xyz123456.jpg');
    expect(result.sessionKey).toBe('XYZ123456');
    expect(result.routingConfidence).toBe('matched');
  });

  it('returns fallback routing for filenames with no session ID', () => {
    const result = parsePhotoFilename('holiday_photo.jpg');
    expect(result.sessionKey).toBe('HOLIDAY-PHOTO');
    expect(result.routingConfidence).toBe('fallback');
    expect(result.sequenceNumber).toBeNull();
  });

  it('returns fallback routing for complex filenames with no session ID', () => {
    const result = parsePhotoFilename('io31erhfuinl_33_2dfds.jpg');
    expect(result.sessionKey).toBe('IO31ERHFUINL-33-2DFDS');
    expect(result.routingConfidence).toBe('fallback');
  });

  it('normalizes a mixed-case session ID to uppercase', () => {
    const result = parsePhotoFilename('Xyz123456.jpg');
    expect(result.sessionKey).toBe('XYZ123456');
    expect(result.routingConfidence).toBe('matched');
  });

  it('strips the file extension before parsing', () => {
    const result = parsePhotoFilename('ABC999999.PNG');
    expect(result.sessionKey).toBe('ABC999999');
    expect(result.routingConfidence).toBe('matched');
  });
});
