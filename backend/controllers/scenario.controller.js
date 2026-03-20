import scenarioService from "../services/scenario.service.js";

export const runScenario = async (req, res, next) => {
    try {
        const { name } = req.params;
        const result = await scenarioService.runScenario(name);
        res.status(200).json(result);
    } catch (error) {
        next(error);
    }
};
