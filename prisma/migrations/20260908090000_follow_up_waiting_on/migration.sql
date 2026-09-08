-- Which side of the conversation went quiet. Purely additive.
--
-- A company can be on the follow-up list because we stopped writing or because
-- they did, and those call for different actions. The single quietDays count
-- could not tell them apart.

CREATE TYPE "FollowUpWaitingOn" AS ENUM ('us', 'them', 'unknown');

ALTER TABLE "follow_ups" ADD COLUMN "ourQuietDays"   INTEGER;
ALTER TABLE "follow_ups" ADD COLUMN "theirQuietDays" INTEGER;
ALTER TABLE "follow_ups" ADD COLUMN "waitingOn"      "FollowUpWaitingOn";
