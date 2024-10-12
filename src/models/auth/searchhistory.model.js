const SearchHistory = (sequelize, Sequelize) => {
    const SearchHistory = sequelize.define("SearchHistory", {
      userId: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      searchQuery: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      searchType: {
        type: Sequelize.STRING, // 'name' or 'driver_license'
        allowNull: false,
      },
      searchedAt: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
    });
  
    SearchHistory.associate = function(models) {
      SearchHistory.belongsTo(models.User, { foreignKey: 'userId', as: 'User' });
    };
  
    return SearchHistory;
  };
  
  export default SearchHistory;
  