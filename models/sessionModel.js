const mongoose = require("mongoose");
const Counter = require("./counterModel");

const seanceSchema = new mongoose.Schema({

  id_seance: {
    type: Number,
    unique: true
  },

  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Service",
    required: true
  },

  enseignant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Enseignant",
    required: true
  },

  etudiants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Etudiant"
  }],

  date_seance: {
    type: Date,
    required: true
  },

  heure_debut: {
    type: String,
    required: true
  },

  heure_fin: {
    type: String,
    required: true
  },

  nombre_max_participants: {
    type: Number,
    default: 1
  },

  type_seance: {
    type: String,
    enum: ["privee", "groupe"],
    default: "privee"
  },

  mode: {
    type: String,
    enum: ["presentiel", "en_ligne"],
    required: true
  },

  lieu: {
    type: String
  },

  lien_visio: {
    type: String
  },

  statut: {
    type: String,
    enum: ["en_attente", "confirmee", "annulee", "terminee", "reportee"],
    default: "en_attente"
  },

  notes_enseignant: {
    type: String
  }

}, { timestamps: true });

//  Auto-increment adapté à ton counterModel
seanceSchema.pre("save", async function (next) {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      "seances",            // _id du compteur
      { $inc: { seq: 1 } }, // incrémenter seq de 1
      { new: true, upsert: true }
    );
    this.id_seance = counter.seq;
  }
  next();
});

module.exports = mongoose.model("Seance", seanceSchema);