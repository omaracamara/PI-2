import { describe, expect, jest, test, beforeEach } from '@jest/globals';
import { Reservation } from '../reservation.model';
import { ReservationError, extendReservation } from '../reservation.service';
import { validateExtensionEndTime } from '../reservation.rules';

jest.mock('../reservation.model', () => ({
  Reservation: {
    findById: jest.fn(),
    find: jest.fn()
  }
}));

const reservationId = '507f1f77bcf86cd799439011';
const parkingSpotId = '507f1f77bcf86cd799439012';
const currentEnd = new Date('2099-10-13T11:00:00.000Z');
const newEnd = '2099-10-13T12:00:00.000Z';

function makeReservation(overrides: Record<string, unknown> = {}) {
  return {
    _id: reservationId,
    parkingSpotId,
    startTime: new Date('2099-10-13T10:00:00.000Z'),
    endTime: currentEnd,
    status: 'ACTIVE',
    save: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    ...overrides
  };
}

const findByIdMock = jest.mocked(Reservation.findById);
const findMock = jest.mocked(Reservation.find);

function mockReservation(reservation: ReturnType<typeof makeReservation> | null) {
  findByIdMock.mockImplementation(() => Promise.resolve(reservation as never) as never);
}

function mockConflicts(conflicts: ReturnType<typeof makeReservation>[] = []) {
  findMock.mockImplementation(() => Promise.resolve(conflicts as never) as never);
}

describe('validateExtensionEndTime', () => {
  const now = new Date('2099-10-13T10:30:00.000Z');

  test('returns a valid end time later than the current end', () => {
    expect(validateExtensionEndTime(currentEnd, newEnd, now)).toEqual(new Date(newEnd));
  });

  test('rejects invalid and non-string end times', () => {
    expect(validateExtensionEndTime(currentEnd, 'not a date', now)).toBeNull();
    expect(validateExtensionEndTime(currentEnd, 123, now)).toBeNull();
  });

  test('rejects an end time that is not strictly later', () => {
    expect(validateExtensionEndTime(currentEnd, currentEnd.toISOString(), now)).toBeNull();
    expect(validateExtensionEndTime(currentEnd, '2099-10-13T10:59:00.000Z', now)).toBeNull();
  });

  test('rejects a reservation whose current end time has passed', () => {
    const expiredEnd = new Date('2099-10-13T10:00:00.000Z');
    expect(validateExtensionEndTime(expiredEnd, newEnd, now)).toBeNull();
  });

  test('rejects a reservation ending exactly now', () => {
    expect(validateExtensionEndTime(now, newEnd, now)).toBeNull();
  });

  test('rejects invalid current-end and current-time dates', () => {
    expect(validateExtensionEndTime(new Date(Number.NaN), newEnd, now)).toBeNull();
    expect(validateExtensionEndTime(currentEnd, newEnd, new Date(Number.NaN))).toBeNull();
  });
});

describe('extendReservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('updates and saves the reservation when no other active reservation conflicts', async () => {
    const reservation = makeReservation();
    mockReservation(reservation);
    mockConflicts();

    const result = await extendReservation(reservationId, newEnd);

    expect(result).toBe(reservation);
    expect(reservation.endTime).toEqual(new Date(newEnd));
    expect(reservation.save).toHaveBeenCalledTimes(1);
    expect(findMock).toHaveBeenCalledWith({
      _id: { $ne: reservationId },
      parkingSpotId,
      status: 'ACTIVE',
      startTime: { $lt: new Date(newEnd) },
      endTime: { $gt: reservation.startTime }
    });
  });

  test('returns not found for an invalid or unknown reservation ID', async () => {
    await expect(extendReservation('invalid-id', newEnd)).rejects.toMatchObject({
      status: 404
    });

    mockReservation(null);
    await expect(extendReservation(reservationId, newEnd)).rejects.toMatchObject({
      status: 404
    });
  });

  test('rejects invalid end-time input with status 400', async () => {
    mockReservation(makeReservation());

    await expect(extendReservation(reservationId, 'not a date')).rejects.toMatchObject({
      status: 400
    });
  });

  test('rejects cancelled and expired reservations with status 409', async () => {
    mockReservation(makeReservation({ status: 'CANCELLED' }));
    await expect(extendReservation(reservationId, newEnd)).rejects.toMatchObject({
      status: 409
    });

    mockReservation(makeReservation({
      endTime: new Date('2000-10-13T11:00:00.000Z')
    }));
    await expect(extendReservation(reservationId, newEnd)).rejects.toMatchObject({
      status: 409
    });
  });

  test('rejects a conflict with another active reservation without saving', async () => {
    const reservation = makeReservation();
    mockReservation(reservation);
    mockConflicts([makeReservation({
      _id: '507f1f77bcf86cd799439013',
      startTime: new Date('2099-10-13T11:30:00.000Z'),
      endTime: new Date('2099-10-13T12:30:00.000Z')
    })]);

    await expect(extendReservation(reservationId, newEnd)).rejects.toBeInstanceOf(ReservationError);
    expect(reservation.save).not.toHaveBeenCalled();
  });

  test('allows an adjacent active reservation', async () => {
    const reservation = makeReservation();
    mockReservation(reservation);
    mockConflicts([makeReservation({
      _id: '507f1f77bcf86cd799439013',
      startTime: new Date(newEnd),
      endTime: new Date('2099-10-13T13:00:00.000Z')
    })]);

    await expect(extendReservation(reservationId, newEnd)).resolves.toBe(reservation);
    expect(reservation.save).toHaveBeenCalledTimes(1);
  });

  test('ignores cancelled reservations when checking for conflicts', async () => {
    const reservation = makeReservation();
    mockReservation(reservation);
    mockConflicts();

    await expect(extendReservation(reservationId, newEnd)).resolves.toBe(reservation);

    expect(findMock).toHaveBeenCalledWith(expect.objectContaining({
      status: 'ACTIVE',
      _id: { $ne: reservationId }
    }));
    expect(reservation.save).toHaveBeenCalledTimes(1);
  });
});
