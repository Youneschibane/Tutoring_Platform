const fs = require('fs');
const path = require('path');

const communesPath = path.resolve(__dirname, '../communes.json');

let communesData = [];
try {
    communesData = JSON.parse(fs.readFileSync(communesPath, 'utf8'));
    console.log("JSON des communes chargé avec succès");
} catch (err) {
    console.error("Impossible de charger communes.json :", err.message);
}

const getWillaya = async (req, res) => {
    const wilayas = [...new Set(communesData.map(item => item.wilaya_name_ascii))].sort();
    res.status(200).json({ status: 'success', wilayas });
};

const getCommuneByWillaya = async (req, res) => {
    const { wilaya } = req.query;
    if (!wilaya) return res.status(400).json({ message: "Précisez la wilaya" });

    const communes = communesData
        .filter(item => item.wilaya_name_ascii.toLowerCase() === wilaya.toLowerCase())
        .map(item => item.commune_name_ascii)
        .sort();

    res.status(200).json({ status: 'success', communes });
};
module.exports = {
    getWillaya , 
    getCommuneByWillaya
}