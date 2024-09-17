import mongoose from "mongoose";

const schedulePostSchema = new mongoose.Schema({
    ScheduledDate: {
        type: Date,
    },
    platform: {
        type: String,
    },
    message: {
        type: String,
    },
    status: {
        type: String,
    },
    belongsTo: {
        type: mongoose.Types.ObjectId,
        ref: "User"
    },
    createdBy: {
        type: mongoose.Types.ObjectId,
        ref: "User"
    }
}, { timestamps: true }
);


export default mongoose.model("scheduleSocialMediaPost", schedulePostSchema);
