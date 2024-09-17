import mongoose from "mongoose";



const userAccountsSchema = new mongoose.Schema(
    {
        belongsTo: {
            type: mongoose.Types.ObjectId,
            ref: "User"
        },
        refresh_token: {
            type: String,
        },
        scope: {
            type: String,
        },
        token_type: {
            type: mongoose.Types.ObjectId,
            default: "Bearer"
        },
    },
    { timestamps: true }
);


export default mongoose.model("userAccounts", userAccountsSchema);
