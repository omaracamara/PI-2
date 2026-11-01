import { isValidObjectId } from 'mongoose';
import { ParkingSpot } from '../parking-spots/parking-spot.model';
import { Reservation } from './reservation.model';
import {
  canReserveSpot,
  hasTimeConflict,
  validateExtensionEndTime,
  validateReservationPeriod
} from './reservation.rules';

export class ReservationError extends Error {
  constructor(public status: 400 | 404 | 409, message: string) {
    super(message);
  }
}

export async function getReservations() {
  return Reservation.find().populate('parkingSpotId', 'number').sort({ startTime: -1 });
}

export async function createReservation(input: {
  parkingSpotId: unknown;
  startTime: unknown;
  endTime: unknown;
}) {
  if (typeof input.parkingSpotId !== 'string' || !isValidObjectId(input.parkingSpotId)) {
    throw new ReservationError(400, 'Invalid parking spot ID');
  }

  const period = validateReservationPeriod(input.startTime, input.endTime);
  if (!period) {
    throw new ReservationError(400, 'Start time must be before end time');
  }

  const spot = await ParkingSpot.findById(input.parkingSpotId);
  if (!spot) {
    throw new ReservationError(404, 'Parking spot not found');
  }

  if (!spot.active) {
    throw new ReservationError(409, 'Parking spot is not active');
  }

  const overlappingReservations = await Reservation.find({
    parkingSpotId: spot._id,
    status: 'ACTIVE',
    startTime: { $lt: period.end },
    endTime: { $gt: period.start }
  });

  const hasConflict = overlappingReservations.some((reservation) =>
    hasTimeConflict(period.start, period.end, reservation.startTime, reservation.endTime)
  );

  if (!canReserveSpot(spot.active, hasConflict)) {
    throw new ReservationError(409, 'Parking spot is not available for this time range');
  }

  return Reservation.create({
    parkingSpotId: spot._id,
    startTime: period.start,
    endTime: period.end,
    status: 'ACTIVE'
  });
}

export async function cancelReservation(id: string) {
  if (!isValidObjectId(id)) {
    return null;
  }

  return Reservation.findByIdAndUpdate(id, { status: 'CANCELLED' }, { new: true });
}

export async function extendReservation(id: string, endTime: unknown) {
  if (!isValidObjectId(id)) {
    throw new ReservationError(404, 'Reservation not found');
  }

  const reservation = await Reservation.findById(id);
  if (!reservation) {
    throw new ReservationError(404, 'Reservation not found');
  }

  if (typeof endTime !== 'string' || Number.isNaN(new Date(endTime).getTime())) {
    throw new ReservationError(400, 'End time must be a valid date and time');
  }

  const extendedEndTime = validateExtensionEndTime(reservation.endTime, endTime, new Date());
  if (reservation.status !== 'ACTIVE' || !extendedEndTime) {
    throw new ReservationError(409, 'Reservation cannot be extended');
  }

  const overlappingReservations = await Reservation.find({
    _id: { $ne: reservation._id },
    parkingSpotId: reservation.parkingSpotId,
    status: 'ACTIVE',
    startTime: { $lt: extendedEndTime },
    endTime: { $gt: reservation.startTime }
  });

  const hasConflict = overlappingReservations.some((otherReservation) =>
    hasTimeConflict(
      reservation.startTime,
      extendedEndTime,
      otherReservation.startTime,
      otherReservation.endTime
    )
  );
  if (hasConflict) {
    throw new ReservationError(409, 'The parking spot is reserved during the extension');
  }

  reservation.endTime = extendedEndTime;
  await reservation.save();
  return reservation;
}
